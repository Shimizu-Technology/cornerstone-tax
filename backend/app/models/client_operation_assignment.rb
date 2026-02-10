# frozen_string_literal: true

class ClientOperationAssignment < ApplicationRecord
  ASSIGNMENT_STATUSES = %w[active paused].freeze

  belongs_to :client
  belongs_to :operation_template
  belongs_to :created_by, class_name: "User", optional: true

  has_many :operation_cycles, dependent: :nullify

  validates :assignment_status, inclusion: { in: ASSIGNMENT_STATUSES }
  validates :operation_template_id, uniqueness: { scope: :client_id }
  validate :date_range_is_valid

  scope :active, -> { where(assignment_status: "active") }
  scope :paused, -> { where(assignment_status: "paused") }

  private

  def date_range_is_valid
    return if starts_on.blank? || ends_on.blank? || ends_on >= starts_on

    errors.add(:ends_on, "must be on or after start date")
  end
end
