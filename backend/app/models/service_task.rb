# frozen_string_literal: true

class ServiceTask < ApplicationRecord
  belongs_to :service_type
  # Deactivate instead of deleting once time uses it (the app only
  # deactivates); nullifying would drop attribution without a version bump.
  has_many :time_entries, dependent: :restrict_with_error
  has_many :time_entry_allocations, dependent: :restrict_with_error

  validates :name, presence: true
  validates :name, uniqueness: { scope: :service_type_id }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  # Set position for new records within the service type
  before_create :set_position

  private

  def set_position
    self.position ||= (service_type.service_tasks.maximum(:position) || 0) + 1
  end
end
