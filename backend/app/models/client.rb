# frozen_string_literal: true

class Client < ApplicationRecord
  has_many :dependents, dependent: :destroy
  has_many :tax_returns, dependent: :destroy
  has_many :intake_submissions, dependent: :destroy
  has_many :time_entries, dependent: :nullify
  has_many :transmittals, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_one :user, dependent: :nullify
  has_many :client_service_types, dependent: :destroy
  has_many :service_types, through: :client_service_types
  has_many :client_contacts, dependent: :destroy
  has_many :client_operation_assignments, dependent: :destroy
  has_many :operation_templates, through: :client_operation_assignments
  has_many :operation_cycles, dependent: :destroy
  has_many :operation_tasks, dependent: :destroy
  has_many :daily_tasks, dependent: :nullify

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :client_type, inclusion: { in: %w[individual business], allow_nil: true }
  validates :notification_preference, inclusion: { in: %w[email none] }

  scope :individuals, -> { where(client_type: 'individual') }
  scope :businesses, -> { where(client_type: 'business') }
  scope :with_tax_returns, -> { where(has_tax_returns: true) }
  scope :service_only, -> { where(has_tax_returns: false) }
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  # Legacy alias for backward compatibility
  scope :tax_clients, -> { with_tax_returns }

  def archived?
    archived_at.present?
  end

  def archive!
    update!(archived_at: Time.current)
  end

  def unarchive!
    update!(archived_at: nil)
  end

  # Encrypt sensitive bank information at rest
  # Requires ACTIVE_RECORD_ENCRYPTION_* environment variables to be set
  encrypts :bank_routing_number_encrypted
  encrypts :bank_account_number_encrypted

  def full_name
    "#{first_name} #{last_name}"
  end

  # The name staff see when choosing or reading a client on time entries and
  # reports: the business name for businesses, otherwise "First Last".
  def display_name
    business_name.presence || full_name.strip.presence || "Client ##{id}"
  end

  # SQL twin of #display_name, used to sort client pickers and reports.
  DISPLAY_NAME_SQL = "COALESCE(NULLIF(TRIM(clients.business_name), ''), TRIM(CONCAT_WS(' ', clients.first_name, clients.last_name)))"

  scope :order_by_display_name, -> { order(Arel.sql("LOWER(#{DISPLAY_NAME_SQL}) ASC"), :id) }
end
