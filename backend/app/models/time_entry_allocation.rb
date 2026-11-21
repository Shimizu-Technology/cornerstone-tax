# frozen_string_literal: true

# One work line of a time entry: what part of the entry's hours went to which
# client and what was done. Lines never change attendance or pay; their hours
# always add up exactly to the entry's hours (enforced on TimeEntry).
#
# Lines are separate rows on purpose so a later change can link a line to an
# assigned task (e.g. an operation task) without touching attendance data.
class TimeEntryAllocation < ApplicationRecord
  UNASSIGNED_LABEL = "Unassigned"

  belongs_to :time_entry, inverse_of: :work_lines
  belongs_to :client, optional: true
  belongs_to :service_type, optional: true
  belongs_to :service_task, optional: true

  before_validation :normalize_fields
  # Every line change moves its entry's change token, in the same
  # transaction (see AddWorkVersionToTimeEntries).
  after_save :bump_entry_work_version, if: :saved_changes?
  after_destroy :bump_entry_work_version

  validates :hours, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 24 }
  validates :period_type, inclusion: { in: TimeEntry::PERIOD_TYPES }, allow_nil: true
  validate :period_fields_consistent
  validate :service_task_matches_service_type
  validate :selected_work_records_exist

  def minutes
    (hours.to_d * 60).round.to_i
  end

  def period_label
    TimeEntry.period_label_for(period_type, period_start)
  end

  def client_label
    client ? client.display_name : UNASSIGNED_LABEL
  end

  # A line's own category; lines backfilled from legacy entries fall back to
  # the entry's legacy time category, marked as such.
  def category_label
    return service_type.name if service_type
    return "#{time_entry.time_category.name} (legacy)" if time_entry&.time_category

    nil
  end

  def work_attributes
    {
      client_id: client_id,
      service_type_id: service_type_id,
      service_task_id: service_task_id,
      period_type: period_type,
      period_start: period_start
    }
  end

  private

  def bump_entry_work_version
    TimeEntry.where(id: time_entry_id).update_all("work_version = work_version + 1")
  end

  def normalize_fields
    self.description = description.to_s.strip.presence
    self.period_type = period_type.presence
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
    return if period_type.blank? || !TimeEntry::PERIOD_TYPES.include?(period_type)

    unless TimeEntry.period_start_aligned?(period_type, period_start)
      errors.add(:period_start, "must be the first day of the selected #{period_type}")
    end
  end

  def service_task_matches_service_type
    return if service_task_id.blank?

    if service_type_id.blank?
      errors.add(:service_task, "needs a category")
    elsif service_task && service_task.service_type_id != service_type_id
      errors.add(:service_task, "must belong to the selected category")
    end
  end

  def selected_work_records_exist
    { client: :client_id, service_type: :service_type_id, service_task: :service_task_id }.each do |association, column|
      next if self[column].blank? || !will_save_change_to_attribute?(column)

      errors.add(association, "no longer exists") if public_send(association).nil?
    end
  end
end
