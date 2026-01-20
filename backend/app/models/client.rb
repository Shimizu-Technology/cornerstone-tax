# frozen_string_literal: true

class Client < ApplicationRecord
  has_many :dependents, dependent: :destroy
  has_many :tax_returns, dependent: :destroy
  has_many :time_entries, dependent: :nullify
  has_many :transmittals, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_one :user, dependent: :nullify

  validates :first_name, presence: true
  validates :last_name, presence: true

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
