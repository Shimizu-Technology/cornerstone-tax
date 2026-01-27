# frozen_string_literal: true

class User < ApplicationRecord
  belongs_to :client, optional: true

  has_many :assigned_tax_returns, class_name: "TaxReturn", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :reviewed_tax_returns, class_name: "TaxReturn", foreign_key: "reviewed_by_id", dependent: :nullify
  has_many :workflow_events, dependent: :nullify
  has_many :time_entries, dependent: :destroy
  has_many :schedules, dependent: :destroy
  has_many :created_schedules, class_name: "Schedule", foreign_key: "created_by_id", dependent: :nullify
  has_many :uploaded_documents, class_name: "Document", foreign_key: "uploaded_by_id", dependent: :nullify
  has_many :created_transmittals, class_name: "Transmittal", foreign_key: "created_by_id", dependent: :nullify

  validates :clerk_id, presence: true, uniqueness: true
  validates :email, presence: true
  validates :role, inclusion: { in: %w[admin employee client] }

  scope :admins, -> { where(role: "admin") }
  scope :employees, -> { where(role: "employee") }
  scope :clients, -> { where(role: "client") }
  scope :staff, -> { where(role: %w[admin employee]) }

  def full_name
    if first_name.present? || last_name.present?
      "#{first_name} #{last_name}".strip
    else
      email
    end
  end

  # Short display name for UI (first name or email prefix)
  def display_name
    if first_name.present?
      first_name
    else
      email.split("@").first
    end
  end

  def admin?
    role == "admin"
  end

  def employee?
    role == "employee"
  end

  def client?
    role == "client"
  end

  def staff?
    admin? || employee?
  end
end
