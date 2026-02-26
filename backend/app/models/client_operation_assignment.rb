# frozen_string_literal: true

class ClientOperationAssignment < ApplicationRecord
  ASSIGNMENT_STATUSES = %w[active paused].freeze
  CADENCE_TYPES = %w[weekly biweekly monthly quarterly custom].freeze

  belongs_to :client
  belongs_to :operation_template
  belongs_to :created_by, class_name: "User", optional: true

  has_many :operation_cycles, dependent: :nullify

  validates :assignment_status, inclusion: { in: ASSIGNMENT_STATUSES }
  validates :cadence_type, inclusion: { in: CADENCE_TYPES }
  validates :operation_template_id, uniqueness: { scope: :client_id }
  validate :date_range_is_valid
  validate :custom_cadence_requires_interval

  scope :active, -> { where(assignment_status: "active") }
  scope :paused, -> { where(assignment_status: "paused") }

  private

  def date_range_is_valid
    return if starts_on.blank? || ends_on.blank? || ends_on >= starts_on

    errors.add(:ends_on, "must be on or after start date")
  end

  def custom_cadence_requires_interval
    return unless cadence_type == "custom"

    if cadence_interval.blank?
      errors.add(:cadence_interval, "is required when cadence type is custom")
      return
    end

    return if cadence_interval.is_a?(Integer) && cadence_interval.positive?

    errors.add(:cadence_interval, "must be a positive integer")
  end
end
