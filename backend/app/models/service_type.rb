# frozen_string_literal: true

class ServiceType < ApplicationRecord
  has_many :service_tasks, dependent: :destroy
  has_many :client_service_types, dependent: :destroy
  has_many :clients, through: :client_service_types
  has_many :time_entries, dependent: :nullify
  has_many :time_entry_allocations, dependent: :nullify

  validates :name, presence: true, uniqueness: true

  # Starter categories for internal work; staff can rename or add to them.
  INTERNAL_DEFAULTS = [ "Office & errands", "Meetings with Dafne", "Training", "Admin" ].freeze

  scope :active, -> { where(is_active: true) }
  scope :internal_work, -> { where(internal: true) }
  scope :client_work, -> { where(internal: false) }

  def self.ensure_internal_defaults!
    INTERNAL_DEFAULTS.each_with_index do |name, index|
      find_or_create_by!(name: name) do |service_type|
        service_type.internal = true
        service_type.position = 1000 + index
        service_type.color = "#64748b"
      end
    end
  end
  scope :ordered, -> { order(:position, :name) }

  # Set position for new records
  before_create :set_position

  private

  def set_position
    self.position ||= (ServiceType.maximum(:position) || 0) + 1
  end
end
