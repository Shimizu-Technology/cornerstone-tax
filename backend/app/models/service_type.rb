# frozen_string_literal: true

class ServiceType < ApplicationRecord
  # Tasks are destroyed by destroy_service_tasks, which reports a task's
  # refusal (e.g. it has logged time) on this category instead of failing
  # with no errors.
  has_many :service_tasks
  has_many :client_service_types, dependent: :destroy
  has_many :clients, through: :client_service_types
  # Deactivate instead of deleting once time uses it (the app only
  # deactivates); nullifying would drop attribution without a version bump.
  has_many :time_entries, dependent: :restrict_with_error
  has_many :time_entry_allocations, dependent: :restrict_with_error

  validates :name, presence: true, uniqueness: true

  before_destroy :destroy_service_tasks

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

  def destroy_service_tasks
    refused = service_tasks.reject(&:destroy)
    refused.each do |task|
      task.errors.full_messages.each { |message| errors.add(:base, "Task #{task.name}: #{message}") }
    end
    throw(:abort) if refused.any?
  end
end
