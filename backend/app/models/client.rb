# frozen_string_literal: true

class Client < ApplicationRecord
  # System clients are created by the app, not by staff. "internal" is
  # Cornerstone itself: office work, errands, meetings, training, admin.
  SYSTEM_KINDS = %w[internal].freeze
  INTERNAL_NAME = "Internal – Cornerstone"
  PROTECTED_NAME_FIELDS = %w[first_name last_name business_name client_type system_kind].freeze

  before_destroy :prevent_system_client_destroy, prepend: true

  has_many :dependents, dependent: :destroy
  has_many :tax_returns, dependent: :destroy
  has_many :intake_submissions, dependent: :destroy
  has_many :matched_intake_submissions, class_name: "IntakeSubmission", foreign_key: :matched_client_id, dependent: :nullify
  has_many :time_entries, dependent: :nullify
  has_many :time_entry_allocations, dependent: :nullify
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
  validates :system_kind, inclusion: { in: SYSTEM_KINDS }, allow_nil: true
  validate :system_client_protected, on: :update

  scope :individuals, -> { where(client_type: 'individual') }
  scope :businesses, -> { where(client_type: 'business') }
  scope :with_tax_returns, -> { where(has_tax_returns: true) }
  scope :service_only, -> { where(has_tax_returns: false) }
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  # Legacy alias for backward compatibility
  scope :tax_clients, -> { with_tax_returns }

  scope :system, -> { where.not(system_kind: nil) }
  # Pickers list the internal client first, then businesses, then people.
  scope :order_for_pickers, lambda {
    order(Arel.sql("CASE WHEN clients.system_kind = 'internal' THEN 0 WHEN clients.client_type = 'business' THEN 1 ELSE 2 END"))
      .order_by_display_name
  }

  def self.internal
    find_by(system_kind: "internal")
  end

  # Creates the internal client if missing (seeds, tests, fresh databases).
  def self.ensure_internal!
    return internal if internal

    existing = where(business_name: INTERNAL_NAME).order(:id).first
    return existing.tap { |client| client.update_columns(system_kind: "internal", archived_at: nil) } if existing

    create!(first_name: "Internal", last_name: "Cornerstone", business_name: INTERNAL_NAME,
            client_type: "business", has_tax_returns: false, is_new_client: false,
            notification_preference: "none", system_kind: "internal")
  rescue ActiveRecord::RecordNotUnique
    internal
  end

  def system?
    system_kind.present?
  end

  def internal?
    system_kind == "internal"
  end

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
  # reports: the business name when one is set, otherwise "First Last".
  def display_name
    business_name.to_s.strip.presence || full_name.strip.presence || "Client ##{id}"
  end

  # SQL twin of #display_name, used to sort client pickers and reports. Trims
  # all whitespace (tabs, newlines) the same way Ruby's #strip does.
  DISPLAY_NAME_SQL = "COALESCE(NULLIF(REGEXP_REPLACE(clients.business_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''), " \
                     "TRIM(CONCAT_WS(' ', clients.first_name, clients.last_name)))"

  scope :order_by_display_name, -> { order(Arel.sql("LOWER(#{DISPLAY_NAME_SQL}) ASC"), :id) }

  private

  def system_client_protected
    return unless system_kind_was.present?

    if (changed & PROTECTED_NAME_FIELDS).any?
      errors.add(:base, "#{INTERNAL_NAME} is a system client and can't be renamed")
    end
    errors.add(:base, "#{INTERNAL_NAME} is a system client and can't be archived") if archived_at.present?
  end

  def prevent_system_client_destroy
    return unless system_kind_was.present?

    errors.add(:base, "#{INTERNAL_NAME} is a system client and can't be deleted")
    throw :abort
  end
end
