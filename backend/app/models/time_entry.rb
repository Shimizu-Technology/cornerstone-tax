# frozen_string_literal: true

class TimeEntry < ApplicationRecord
  ENTRY_METHODS = %w[clock manual].freeze
  STATUSES = %w[clocked_in on_break completed].freeze
  ATTENDANCE_STATUSES = %w[early on_time late].freeze
  APPROVAL_STATUSES = %w[pending approved denied].freeze
  OVERTIME_STATUSES = %w[none pending approved denied].freeze
  # Optional accounting period the work applies to (e.g. July 2026 bank rec).
  # period_start is always the first day of the month, quarter or year.
  PERIOD_TYPES = %w[month quarter year].freeze
  QUARTER_START_MONTHS = [ 1, 4, 7, 10 ].freeze

  belongs_to :user, optional: true
  belongs_to :client, optional: true
  belongs_to :tax_return, optional: true
  belongs_to :time_category, optional: true
  belongs_to :service_type, optional: true
  belongs_to :service_task, optional: true
  belongs_to :schedule, optional: true
  belongs_to :approved_by, class_name: "User", optional: true # stores acting admin for both approvals and denials; check approval_status for action type
  belongs_to :overtime_approved_by, class_name: "User", optional: true
  has_many :time_entry_breaks, dependent: :destroy
  has_many :linked_operation_tasks, class_name: "OperationTask", foreign_key: "linked_time_entry_id", dependent: :nullify
  # How the entry's hours were spent, by client. See TimeEntryAllocation.
  has_many :work_lines, -> { order(:position, :id) }, class_name: "TimeEntryAllocation",
           inverse_of: :time_entry, dependent: :delete_all, autosave: true

  # Entry-level work columns mirror the first work line (kept for older
  # screens, filters and the payroll time summary).
  WORK_LINE_SYNC_FIELDS = %i[client_id service_type_id service_task_id period_type period_start].freeze

  validates :work_date, presence: true
  validates :hours, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 24 }
  validate :completed_manual_entry_has_positive_hours
  validates :entry_method, presence: true, inclusion: { in: ENTRY_METHODS }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :attendance_status, inclusion: { in: ATTENDANCE_STATUSES }, allow_nil: true
  validates :approval_status, inclusion: { in: APPROVAL_STATUSES }, allow_nil: true
  validates :overtime_status, inclusion: { in: OVERTIME_STATUSES }, allow_nil: true
  validates :start_time, presence: true, if: -> { status == "completed" && !duration_only? }
  validates :end_time, presence: true, if: -> { status == "completed" && !duration_only? }
  validate :end_time_after_start_time
  validate :service_task_matches_service_type
  validates :period_type, inclusion: { in: PERIOD_TYPES }, allow_nil: true
  validate :period_fields_consistent
  validate :selected_work_records_exist
  validate :work_lines_match_hours
  # Set by user-facing flows (clock-out, manual create/edit) so the
  # client/description cutover is enforced there; see TimeEntryWorkRequirement.
  attr_accessor :enforce_work_requirement
  validate :work_requirement_met, if: :enforce_work_requirement

  before_validation :normalize_blank_period

  before_validation :calculate_hours_from_times, if: -> { start_time.present? && end_time.present? }
  before_validation :set_zero_hours_if_clocked_in, if: -> { status.in?(%w[clocked_in on_break]) }
  # Runs last: line hours are split from the entry's final hours.
  before_validation :apply_work_lines
  after_save :clear_work_lines_input

  attr_reader :work_lines_input
  attr_writer :work_lines_tolerance_minutes

  scope :for_date, ->(date) { where(work_date: date) }
  scope :for_week, ->(date) { where(work_date: date.beginning_of_week(:sunday)..date.end_of_week(:sunday)) }
  scope :for_user, ->(user) { where(user: user) }
  scope :recent, -> { order(work_date: :desc, created_at: :desc) }
  scope :clocked_in, -> { where(status: %w[clocked_in on_break]) }
  scope :pending_approval, -> { where(approval_status: "pending") }
  scope :approved, -> { where(approval_status: [ "approved", nil ]) }
  scope :denied, -> { where(approval_status: "denied") }
  # Filter by work period. Either part may be omitted: a type alone matches
  # every entry with that kind of period, a start alone matches any type.
  scope :for_work_period, lambda { |type, start|
    scope = all
    scope = scope.where(period_type: type) if type.present?
    scope = scope.where(period_start: start) if start.present?
    scope
  }
  # Entries whose own column or any work line has the value (a split entry
  # matches every client it was split across).
  scope :with_work_line_value, lambda { |column, value|
    column = column.to_sym
    raise ArgumentError, "unsupported work line column" unless WORK_LINE_SYNC_FIELDS.include?(column)

    where(
      "time_entries.#{column} = :value OR time_entries.id IN " \
      "(SELECT time_entry_allocations.time_entry_id FROM time_entry_allocations WHERE time_entry_allocations.#{column} = :value)",
      value: value
    )
  }
  scope :clock_entries, -> { where(entry_method: "clock") }
  scope :manual_entries, -> { where(entry_method: "manual") }
  # Clock entries have nil approval_status (they don't go through the approval
  # flow), so nil is intentionally treated as countable alongside "approved".
  scope :countable, -> { where("approval_status IS NULL OR approval_status NOT IN (?)", %w[denied pending]).where(status: "completed") }

  def locked?
    locked_at.present?
  end

  # Every write that can change an entry's work lines (edit, clock-out,
  # approval, deletion, stale auto-close) calls this inside its transaction
  # first: it takes the row lock (SELECT ... FOR UPDATE) and re-reads the
  # entry with its lines dropped from cache, so the lines are loaded only
  # while the lock is held. Two concurrent saves therefore cannot both
  # replace the same old lines and leave lines summing to more than the
  # entry's hours. Submitted work lines (work_lines_input) survive the reload.
  def lock_for_work_lines!
    raise ActiveRecord::TransactionIsolationError, "lock_for_work_lines! must run inside a transaction" unless self.class.connection.transaction_open?

    lock!
    work_lines.reset
    self
  end

  # Runs a multi-query read (reports, exports, feeds) against one snapshot,
  # so entries and their work lines come from the same moment. Inside an
  # existing transaction (e.g. tests) it just yields.
  def self.consistent_read(&block)
    return yield if connection.transaction_open?

    transaction(isolation: :repeatable_read, &block)
  end

  # Replace this entry's work lines on the next save. Each line is a hash of
  # client_id, description, service_type_id, service_task_id, period_type,
  # period_start and a duration (minutes, hours or a "45m"/"1.5h" string).
  # nil leaves the lines alone (a single line then follows the entry).
  def work_lines_input=(lines)
    @work_lines_input = lines.nil? ? nil : Array(lines).map { |line| line.to_h.symbolize_keys }
  end

  def work_lines_tolerance_minutes
    @work_lines_tolerance_minutes || WorkLineHours::DEFAULT_TOLERANCE_MINUTES
  end

  # A manual entry logged as a list of durations, with no start/end times.
  # Its hours are the sum of its work lines.
  def duration_only?
    manual_entry? && start_time.blank? && end_time.blank?
  end

  def current_work_lines
    work_lines.reject(&:marked_for_destruction?)
  end

  def split?
    current_work_lines.size > 1
  end

  def editable_by?(acting_user)
    return false if locked?
    acting_user.admin? || user_id == acting_user.id
  end

  def deletable_by?(acting_user)
    editable_by?(acting_user)
  end

  def clock_entry?
    entry_method == "clock"
  end

  def manual_entry?
    entry_method == "manual"
  end

  def active?
    status.in?(%w[clocked_in on_break])
  end

  def pending_approval?
    approval_status == "pending"
  end

  def counts_toward_hours?
    status == "completed" && !approval_status.in?(%w[denied pending])
  end

  def active_payroll_exports
    ReportExport.active_for_entry(id)
  end

  def total_break_minutes
    if time_entry_breaks.loaded?
      time_entry_breaks.select { |b| b.duration_minutes.present? }.sum(&:duration_minutes)
    else
      time_entry_breaks.where.not(duration_minutes: nil).sum(:duration_minutes)
    end
  end

  def active_break
    if time_entry_breaks.loaded?
      time_entry_breaks.find { |b| b.end_time.nil? }
    else
      time_entry_breaks.where(end_time: nil).first
    end
  end

  # hours already has break time deducted via calculate_hours_from_times
  def net_hours
    return 0 unless hours.present?
    hours.round(2)
  end

  def calculate_hours_from_times
    return unless start_time.present? && end_time.present?

    start_seconds = start_time.utc.seconds_since_midnight
    end_seconds = end_time.utc.seconds_since_midnight

    if end_seconds < start_seconds
      end_seconds += 24 * 3600
    end

    duration_hours = (end_seconds - start_seconds) / 3600.0

    if break_minutes.present? && break_minutes > 0
      duration_hours -= (break_minutes / 60.0)
    end

    self.hours = [ duration_hours, 0 ].max.round(2)
  end

  # "July 2026", "3rd Quarter 2026", "2026", or nil when no period is set.
  def period_label
    self.class.period_label_for(period_type, period_start)
  end

  def self.period_label_for(type, start)
    return nil if type.blank? || start.blank?

    case type.to_s
    when "month" then start.strftime("%B %Y")
    when "quarter"
      quarter = (start.month - 1) / 3 + 1
      "#{quarter}#{quarter_ordinal_suffix(quarter)} Quarter #{start.year}"
    when "year" then start.year.to_s
    end
  end

  def self.quarter_ordinal_suffix(quarter)
    { 1 => "st", 2 => "nd", 3 => "rd" }.fetch(quarter, "th")
  end

  def self.period_start_aligned?(type, start)
    return false if start.blank? || start.day != 1

    case type.to_s
    when "month" then true
    when "quarter" then QUARTER_START_MONTHS.include?(start.month)
    when "year" then start.month == 1
    else false
    end
  end

  # The work category staff picked. New entries use the two-level service
  # type/task lists; older entries may only have a legacy time category, which
  # is shown as-is (marked legacy) and never rewritten.
  def category_label
    return service_type.name if service_type
    return "#{time_category.name} (legacy)" if time_category

    nil
  end

  def formatted_start_time
    start_time&.in_time_zone(TimeClockService::BUSINESS_TIMEZONE)&.strftime("%I:%M %p")&.sub(/^0/, "")
  end

  def formatted_end_time
    end_time&.in_time_zone(TimeClockService::BUSINESS_TIMEZONE)&.strftime("%I:%M %p")&.sub(/^0/, "")
  end

  private

  def clear_work_lines_input
    @work_lines_input = nil
  end

  def apply_work_lines
    @work_lines_error = nil
    return unless status == "completed"

    if @work_lines_input
      build_submitted_work_lines
    else
      sync_single_work_line
    end
  rescue WorkLineHours::Error => e
    @work_lines_error = e.message
  end

  def build_submitted_work_lines
    raise WorkLineHours::Error, "Add at least one work line" if @work_lines_input.empty?

    times = @work_lines_input.map { |line| WorkLineHours.line_time(line) }
    if duration_only?
      flexible_minutes = times.sum { |time| time[:minutes] || 0 }
      self.hours = times.sum { |time| time[:exact] || 0 } + (flexible_minutes.positive? ? WorkLineHours.hours_for_minutes(flexible_minutes) : 0)
    end
    parts = WorkLineHours.allocate(hours, times, tolerance_minutes: work_lines_tolerance_minutes)

    work_lines.each { |line| line.mark_for_destruction if line.persisted? }
    built = @work_lines_input.each_with_index.map do |line, index|
      work_lines.build(
        client_id: line[:client_id].presence,
        description: line[:description],
        service_type_id: line[:service_type_id].presence,
        service_task_id: line[:service_type_id].present? ? line[:service_task_id].presence : nil,
        period_type: line[:period_type].presence,
        period_start: line[:period_start].presence,
        hours: parts[index],
        position: index
      )
    end
    work_lines.reject { |line| line.persisted? || built.include?(line) }.each { |line| work_lines.delete(line) }

    first = built.first
    assign_attributes(first.work_attributes)
    # One line: the entry mirrors it exactly (so the legacy columns hold the
    # whole story). Several lines: their descriptions, joined.
    self.description = if built.size == 1
      first.description
    else
      built.filter_map { |line| line.description.to_s.strip.presence }.uniq.join("; ").presence
    end
  end

  def sync_single_work_line
    lines = current_work_lines

    # A split entry is defined by its lines: its own work fields (including
    # the joined description) can only change by submitting new lines, and
    # an hours change must come with re-balanced lines. Checked before the
    # zero-hours branch so a split is never silently dropped.
    if lines.size > 1
      changed_fields = (WORK_LINE_SYNC_FIELDS + [ :description ]).select { |field| will_save_change_to_attribute?(field) }
      if changed_fields.any?
        raise WorkLineHours::Error, "This entry is split across several work lines. Change the work lines instead."
      end
      if hours.to_d <= 0
        raise WorkLineHours::Error, "This change leaves no time for this entry's #{lines.size} work lines. Update the work lines first."
      end
      return
    end

    # Zero hours (e.g. a clock in and out within a minute): nothing to attribute.
    if hours.to_d <= 0
      lines.each(&:mark_for_destruction)
      return
    end

    # A day log without times is defined by its lines; never invent one.
    return if lines.empty? && duration_only?

    line = lines.first || work_lines.build(position: 0)
    line.assign_attributes(
      client_id: client_id,
      service_type_id: service_type_id,
      service_task_id: service_task_id,
      period_type: period_type,
      period_start: period_start,
      description: description,
      hours: hours.to_d.round(2)
    )
  end

  def work_lines_match_hours
    if @work_lines_error
      errors.add(:base, @work_lines_error)
      return
    end
    return unless status == "completed"

    lines = current_work_lines
    if lines.empty?
      errors.add(:base, "Add work lines or start and end times") if duration_only?
      return
    end

    total = lines.sum { |line| line.hours.to_d }
    return if total == hours.to_d.round(2)

    errors.add(:base, "Work lines add up to #{format('%.2f', total)}h but this entry is #{format('%.2f', hours.to_d)}h. Update the work lines to match.")
  end

  def work_requirement_met
    TimeEntryWorkRequirement.errors_for(self).each { |message| errors.add(:base, message) }
  end

  def set_zero_hours_if_clocked_in
    self.hours = 0 if hours.blank?
  end

  def end_time_after_start_time
    return unless start_time.present? && end_time.present?

    if clock_entry? && clock_in_at.present? && clock_out_at.present?
      errors.add(:end_time, "must be after start time") if clock_out_at <= clock_in_at
      return
    end

    tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
    start_local = start_time.in_time_zone(tz).seconds_since_midnight
    end_local = end_time.in_time_zone(tz).seconds_since_midnight

    # End times earlier than start times are valid overnight entries; equal
    # start/end times are still invalid because they calculate to zero hours.
    errors.add(:end_time, "must be after start time") if end_local == start_local
  end

  def service_task_matches_service_type
    return unless service_task_id.present? && service_type_id.present?

    unless service_task&.service_type_id == service_type_id
      errors.add(:service_task, "must belong to the selected service type")
    end
  end

  def normalize_blank_period
    self.period_type = period_type.presence
    # Only clear genuinely blank input; a value that failed to cast to a date
    # is kept so validation can reject it instead of silently dropping it.
    self.period_start = nil if period_start_before_type_cast.blank?
  end

  def period_fields_consistent
    if period_start_before_type_cast.present? && !period_start.is_a?(Date)
      errors.add(:period_start, "must be a valid date (YYYY-MM-DD)")
      return
    end

    if period_type.present? != period_start.present?
      errors.add(:period_start, "and period type must both be set or both be blank")
      return
    end
    return if period_type.blank? || !PERIOD_TYPES.include?(period_type)

    unless self.class.period_start_aligned?(period_type, period_start)
      errors.add(:period_start, "must be the first day of the selected #{period_type}")
    end
  end

  # Optional references are not validated by belongs_to; catch a client,
  # category or task that was removed after the form loaded (422, not a
  # foreign-key 500).
  def selected_work_records_exist
    { client: :client_id, service_type: :service_type_id, service_task: :service_task_id }.each do |association, column|
      next if self[column].blank? || !will_save_change_to_attribute?(column)

      errors.add(association, "no longer exists") if public_send(association).nil?
    end
  end

  def completed_manual_entry_has_positive_hours
    return unless manual_entry? && status == "completed"
    return unless hours.present? && hours <= 0

    errors.add(:hours, "must be greater than 0 for completed entries")
  end
end
