# frozen_string_literal: true

class User < ApplicationRecord
  EMPLOYMENT_STATUSES = %w[active terminated].freeze

  belongs_to :client, optional: true
  belongs_to :terminated_by, class_name: "User", optional: true

  has_many :assigned_tax_returns, class_name: "TaxReturn", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :reviewed_tax_returns, class_name: "TaxReturn", foreign_key: "reviewed_by_id", dependent: :nullify
  has_many :workflow_events, dependent: :nullify
  has_many :audit_logs, dependent: :nullify
  has_many :time_entries, dependent: :nullify
  has_many :approved_time_entries, class_name: "TimeEntry", foreign_key: "approved_by_id", dependent: :nullify
  has_many :overtime_approved_time_entries, class_name: "TimeEntry", foreign_key: "overtime_approved_by_id", dependent: :nullify
  has_many :schedules, dependent: :nullify
  has_many :created_schedules, class_name: "Schedule", foreign_key: "created_by_id", dependent: :nullify
  has_many :uploaded_documents, class_name: "Document", foreign_key: "uploaded_by_id", dependent: :nullify
  has_many :created_transmittals, class_name: "Transmittal", foreign_key: "created_by_id", dependent: :nullify
  has_many :time_period_locks, foreign_key: "locked_by_id", dependent: :nullify
  has_many :generated_report_exports, class_name: "ReportExport", foreign_key: "generated_by_id", dependent: :nullify
  has_many :client_operation_assignments, foreign_key: "created_by_id", dependent: :nullify
  has_many :generated_operation_cycles, class_name: "OperationCycle", foreign_key: "generated_by_id", dependent: :nullify
  has_many :assigned_operation_tasks, class_name: "OperationTask", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :completed_operation_tasks, class_name: "OperationTask", foreign_key: "completed_by_id", dependent: :nullify
  has_many :default_operation_template_tasks, class_name: "OperationTemplateTask", foreign_key: "default_assignee_id", dependent: :nullify
  has_many :created_operation_templates, class_name: "OperationTemplate", foreign_key: "created_by_id", dependent: :nullify
  has_many :assigned_daily_tasks, class_name: "DailyTask", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :reviewed_daily_tasks, class_name: "DailyTask", foreign_key: "reviewed_by_id", dependent: :nullify
  has_many :created_daily_tasks, class_name: "DailyTask", foreign_key: "created_by_id", dependent: :nullify
  has_many :completed_daily_tasks, class_name: "DailyTask", foreign_key: "completed_by_id", dependent: :nullify
  has_many :status_changed_daily_tasks, class_name: "DailyTask", foreign_key: "status_changed_by_id", dependent: :nullify
  has_many :terminated_users, class_name: "User", foreign_key: "terminated_by_id", dependent: :nullify

  validates :clerk_id, presence: true, uniqueness: true
  validates :email, presence: true
  validates :role, inclusion: { in: %w[admin employee client] }
  validates :employment_status, inclusion: { in: EMPLOYMENT_STATUSES }
  validates :terminated_at, presence: true, if: :terminated?
  validates :termination_reason, length: { maximum: 2_000 }, allow_blank: true

  before_destroy :prevent_hard_deletion

  scope :admins, -> { where(role: "admin") }
  scope :employees, -> { where(role: "employee") }
  scope :clients, -> { where(role: "client") }
  scope :staff, -> { where(role: %w[admin employee]) }
  scope :active_employment, -> { where(employment_status: "active") }
  scope :terminated, -> { where(employment_status: "terminated") }
  scope :active_staff, -> { staff.active_employment }

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

  def employment_active?
    employment_status == "active"
  end

  def terminated?
    employment_status == "terminated"
  end

  def terminate!(by:, effective_on: nil, reason: nil)
    update!(
      employment_status: "terminated",
      termination_effective_on: effective_on,
      terminated_at: Time.current,
      termination_reason: reason.presence,
      terminated_by: by
    )
  end

  def reactivate!
    update!(
      employment_status: "active",
      termination_effective_on: nil,
      terminated_at: nil,
      termination_reason: nil,
      terminated_by: nil
    )
  end

  def portal_active?
    client? && clerk_id.present? && !clerk_id.start_with?("pending_")
  end

  def portal_invite_pending?
    client? && clerk_id.present? && clerk_id.start_with?("pending_")
  end

  private

  def prevent_hard_deletion
    errors.add(:base, "Users cannot be permanently deleted; terminate or deactivate the account instead")
    throw(:abort)
  end
end
