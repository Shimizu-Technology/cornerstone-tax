# frozen_string_literal: true

class User < ApplicationRecord
  belongs_to :client, optional: true

  has_many :assigned_tax_returns, class_name: "TaxReturn", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :reviewed_tax_returns, class_name: "TaxReturn", foreign_key: "reviewed_by_id", dependent: :nullify
  has_many :workflow_events, dependent: :nullify
  has_many :audit_logs, dependent: :nullify
  has_many :time_entries, dependent: :destroy
  has_many :approved_time_entries, class_name: "TimeEntry", foreign_key: "approved_by_id", dependent: :nullify
  has_many :overtime_approved_time_entries, class_name: "TimeEntry", foreign_key: "overtime_approved_by_id", dependent: :nullify
  has_many :schedules, dependent: :destroy
  has_many :created_schedules, class_name: "Schedule", foreign_key: "created_by_id", dependent: :nullify
  has_many :uploaded_documents, class_name: "Document", foreign_key: "uploaded_by_id", dependent: :nullify
  has_many :created_transmittals, class_name: "Transmittal", foreign_key: "created_by_id", dependent: :nullify
  has_many :time_period_locks, foreign_key: "locked_by_id", dependent: :nullify
  has_many :client_operation_assignments, foreign_key: "created_by_id", dependent: :nullify
  has_many :generated_operation_cycles, class_name: "OperationCycle", foreign_key: "generated_by_id", dependent: :nullify
  has_many :assigned_operation_tasks, class_name: "OperationTask", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :completed_operation_tasks, class_name: "OperationTask", foreign_key: "completed_by_id", dependent: :nullify
  has_many :default_operation_template_tasks, class_name: "OperationTemplateTask", foreign_key: "default_assignee_id", dependent: :nullify
  has_many :created_operation_templates, class_name: "OperationTemplate", foreign_key: "created_by_id", dependent: :nullify

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

  def portal_active?
    client? && clerk_id.present? && !clerk_id.start_with?("pending_")
  end

  def portal_invite_pending?
    client? && clerk_id.present? && clerk_id.start_with?("pending_")
  end
end
