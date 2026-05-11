# frozen_string_literal: true

class TaxReturn < ApplicationRecord
  RETURN_TYPES = %w[individual business amended prior_year extension notice other].freeze
  JURISDICTIONS = %w[federal guam both other].freeze
  SOURCES = %w[public_intake admin_created spreadsheet_import portal legacy_import].freeze
  PRIORITIES = %w[normal high urgent].freeze
  PAYMENT_STATUSES = %w[unpaid partially_paid paid waived].freeze
  FILING_STATUSES = %w[not_filed ready_to_file filed_drt filed_irs accepted rejected paper_filed].freeze
  SIGNATURE_STATUSES = %w[not_needed requested signed waived].freeze

  belongs_to :client
  belongs_to :workflow_stage, optional: true
  belongs_to :assigned_to, class_name: "User", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true

  has_many :income_sources, dependent: :destroy
  has_many :intake_submissions, dependent: :destroy
  has_many :workflow_events, dependent: :destroy
  has_many :documents, dependent: :destroy
  has_many :time_entries, dependent: :nullify
  has_many :transmittals, dependent: :nullify
  has_many :notifications, dependent: :destroy

  validates :tax_year, presence: true, numericality: { only_integer: true }
  validates :client_id, uniqueness: {
    scope: [:tax_year, :return_type, :form_type],
    message: "already has this return type/form for this tax year"
  }
  validates :return_type, inclusion: { in: RETURN_TYPES }
  validates :jurisdiction, inclusion: { in: JURISDICTIONS }
  validates :source, inclusion: { in: SOURCES }
  validates :priority, inclusion: { in: PRIORITIES }
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :filing_status, inclusion: { in: FILING_STATUSES }
  validates :signature_status, inclusion: { in: SIGNATURE_STATUSES }
  validates :base_fee_cents, :discount_amount_cents, :amount_paid_cents,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :for_year, ->(year) { where(tax_year: year) }
  scope :current_year, -> { for_year(Date.current.year) }

  # Store current user for audit logging (set by controller)
  attr_accessor :current_actor

  after_save :log_status_change, if: :saved_change_to_workflow_stage_id?
  after_save :log_assignment_change, if: :saved_change_to_assigned_to_id?
  after_save :log_notes_change, if: :saved_change_to_notes?
  after_save :log_payment_change, if: :saved_change_to_payment_fields?
  after_save :log_filing_change, if: :saved_change_to_filing_fields?
  after_save :log_portal_change, if: :saved_change_to_portal_fields?
  before_validation :sync_operational_timestamps
  after_commit :send_status_notification, on: :update, if: :saved_change_to_workflow_stage_id?

  def status_name
    workflow_stage&.name || "Unknown"
  end

  def final_fee_cents
    [base_fee_cents.to_i - discount_amount_cents.to_i, 0].max
  end

  def balance_due_cents
    [final_fee_cents - amount_paid_cents.to_i, 0].max
  end

  def sync_operational_timestamps
    self.form_type = "general" if form_type.blank?
    self.received_at ||= Time.current
    self.paid_at = Time.current if payment_status == "paid" && paid_at.blank?
    self.filed_at = Time.current if filing_status.start_with?("filed_") && filed_at.blank?
    self.signature_requested_at = Time.current if signature_status == "requested" && signature_requested_at.blank?
    self.signed_at = Time.current if signature_status == "signed" && signed_at.blank?
  end

  private

  def log_status_change
    old_stage = WorkflowStage.find_by(id: workflow_stage_id_before_last_save)
    workflow_events.create!(
      event_type: "status_changed",
      old_value: old_stage&.name,
      new_value: workflow_stage&.name,
      description: "Status changed from #{old_stage&.name || 'none'} to #{workflow_stage&.name}",
      user: current_actor
    )
  end

  def send_status_notification
    StatusNotificationJob.perform_later(id, workflow_stage_id)
  rescue StandardError => e
    Rails.logger.error "Failed to enqueue notification for tax return #{id}: #{e.message}"
  end

  def log_assignment_change
    old_user = User.find_by(id: assigned_to_id_before_last_save)
    workflow_events.create!(
      event_type: "assigned",
      old_value: old_user&.full_name,
      new_value: assigned_to&.full_name,
      description: "Assigned to #{assigned_to&.full_name || 'unassigned'}",
      user: current_actor
    )
  end

  def log_notes_change
    workflow_events.create!(
      event_type: "note_added",
      old_value: notes_before_last_save,
      new_value: notes,
      description: "Notes updated",
      user: current_actor
    )
  end

  def saved_change_to_payment_fields?
    saved_change_to_payment_status? ||
      saved_change_to_base_fee_cents? ||
      saved_change_to_discount_amount_cents? ||
      saved_change_to_discount_reason? ||
      saved_change_to_amount_paid_cents? ||
      saved_change_to_paid_at? ||
      saved_change_to_payment_notes?
  end

  def saved_change_to_filing_fields?
    saved_change_to_filing_status? ||
      saved_change_to_filed_at? ||
      saved_change_to_drt_confirmation? ||
      saved_change_to_irs_confirmation?
  end

  def saved_change_to_portal_fields?
    saved_change_to_portal_visible? ||
      saved_change_to_documents_enabled? ||
      saved_change_to_signature_status? ||
      saved_change_to_signature_requested_at? ||
      saved_change_to_signed_at?
  end

  def log_payment_change
    workflow_events.create!(
      event_type: "payment_updated",
      old_value: payment_status_before_last_save,
      new_value: payment_status,
      description: "Payment details updated",
      user: current_actor
    )
  end

  def log_filing_change
    workflow_events.create!(
      event_type: "filing_updated",
      old_value: filing_status_before_last_save,
      new_value: filing_status,
      description: "Filing details updated",
      user: current_actor
    )
  end

  def log_portal_change
    workflow_events.create!(
      event_type: "portal_updated",
      old_value: portal_visible_before_last_save&.to_s,
      new_value: portal_visible.to_s,
      description: "Client portal settings updated",
      user: current_actor
    )
  end
end
