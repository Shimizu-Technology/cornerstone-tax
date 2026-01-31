# frozen_string_literal: true

class Client < ApplicationRecord
  has_many :dependents, dependent: :destroy
  has_many :tax_returns, dependent: :destroy
  has_many :time_entries, dependent: :nullify
  has_many :transmittals, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_one :user, dependent: :nullify
  has_many :client_service_types, dependent: :destroy
  has_many :service_types, through: :client_service_types

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :client_type, inclusion: { in: %w[individual business], allow_nil: true }

  scope :individuals, -> { where(client_type: 'individual') }
  scope :businesses, -> { where(client_type: 'business') }
  scope :service_only, -> { where(is_service_only: true) }
  scope :tax_clients, -> { where(is_service_only: false) }

  # Encrypt sensitive bank information at rest
  # Requires ACTIVE_RECORD_ENCRYPTION_* environment variables to be set
  encrypts :bank_routing_number_encrypted
  encrypts :bank_account_number_encrypted

  def full_name
    "#{first_name} #{last_name}"
  end

  def display_name
    full_name
  end
end
