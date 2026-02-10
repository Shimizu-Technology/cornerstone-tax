# frozen_string_literal: true

class TimeEntry < ApplicationRecord
  belongs_to :user
  belongs_to :client, optional: true
  belongs_to :tax_return, optional: true
  belongs_to :time_category, optional: true
  belongs_to :service_type, optional: true
  belongs_to :service_task, optional: true
  has_one :linked_operation_task, class_name: "OperationTask", foreign_key: "linked_time_entry_id", dependent: :nullify

  validates :work_date, presence: true
  validates :start_time, presence: true
  validates :end_time, presence: true
  validates :hours, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 24 }
  validate :end_time_after_start_time
  # NOTE: service_type is intentionally optional when a client is selected.
  # This allows flexibility for internal meetings or general client work.
  # If stricter tracking is needed later, uncomment the validation below:
  # validate :service_type_required_if_client
  validate :service_task_matches_service_type

  before_validation :calculate_hours_from_times

  scope :for_date, ->(date) { where(work_date: date) }
  scope :for_week, ->(date) { where(work_date: date.beginning_of_week..date.end_of_week) }
  scope :for_user, ->(user) { where(user: user) }
  scope :recent, -> { order(work_date: :desc, created_at: :desc) }

  # Calculate hours from start/end times minus break
  def calculate_hours_from_times
    return unless start_time.present? && end_time.present?

    # Calculate duration in hours
    start_seconds = start_time.seconds_since_midnight
    end_seconds = end_time.seconds_since_midnight

    # Handle case where end time might be the next day (unlikely but possible)
    if end_seconds < start_seconds
      end_seconds += 24 * 3600
    end

    duration_hours = (end_seconds - start_seconds) / 3600.0

    # Subtract break time if present
    if break_minutes.present? && break_minutes > 0
      duration_hours -= (break_minutes / 60.0)
    end

    self.hours = [ duration_hours, 0 ].max.round(2)
  end

  # Format times for display
  def formatted_start_time
    start_time&.strftime("%I:%M %p")&.sub(/^0/, "")
  end

  def formatted_end_time
    end_time&.strftime("%I:%M %p")&.sub(/^0/, "")
  end

  private

  def end_time_after_start_time
    return unless start_time.present? && end_time.present?

    if end_time <= start_time
      errors.add(:end_time, "must be after start time")
    end
  end

  # NOTE: Validation commented out - service_type is optional even with client selected.
  # Uncomment if stricter tracking is needed:
  # def service_type_required_if_client
  #   if client_id.present? && service_type_id.blank?
  #     errors.add(:service_type, "is required when a client is selected")
  #   end
  # end

  # If service_task is selected, it must belong to the selected service_type
  def service_task_matches_service_type
    return unless service_task_id.present? && service_type_id.present?
    return unless service_task # Guard against invalid service_task_id

    unless service_task.service_type_id == service_type_id
      errors.add(:service_task, "must belong to the selected service type")
    end
  end
end
