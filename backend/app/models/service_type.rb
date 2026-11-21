# frozen_string_literal: true

class ServiceType < ApplicationRecord
  has_many :service_tasks, dependent: :destroy
  has_many :client_service_types, dependent: :destroy
  has_many :clients, through: :client_service_types
  has_many :time_entries, dependent: :nullify
  has_many :time_entry_allocations, dependent: :nullify

  validates :name, presence: true, uniqueness: true

  # Starter categories for internal work, keyed by a stable system_key so
  # they are found again after a rename; staff can rename or add to them.
  INTERNAL_DEFAULTS = {
    "internal_office_errands" => "Office & errands",
    "internal_meetings" => "Meetings with Dafne",
    "internal_training" => "Training",
    "internal_admin" => "Admin"
  }.freeze

  scope :active, -> { where(is_active: true) }
  scope :internal_work, -> { where(internal: true) }
  scope :client_work, -> { where(internal: false) }

  # Same policy as the migration: find each default by its key, then by name
  # (case-insensitive, reusing a category staff already made and logging
  # it), and only create it when neither exists.
  def self.ensure_internal_defaults!
    INTERNAL_DEFAULTS.each_with_index do |(key, name), index|
      record = find_by(system_key: key) || where(system_key: nil).where("LOWER(name) = LOWER(?)", name).order(:id).first
      if record.nil?
        create!(name: name, internal: true, system_key: key, position: 1000 + index, color: "#64748b")
      elsif !record.internal? || record.system_key != key
        Rails.logger.warn("[ServiceType] Reusing existing category #{record.name.inspect} (id #{record.id}) as internal category #{key}") if record.system_key.nil?
        record.update!(internal: true, system_key: key)
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
