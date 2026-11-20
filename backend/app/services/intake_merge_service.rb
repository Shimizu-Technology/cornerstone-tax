# frozen_string_literal: true

# Merges a public intake that matched an existing client (status
# "needs_review") into that client, as chosen by staff.
#
# - Only the client fields staff select are copied onto the existing client.
# - Submitted dependents are added when requested; existing dependents with
#   the same name are kept as they are.
# - The intake's return work (documents, income sources, activity) moves to
#   the existing client's return for that year, or the intake return itself
#   moves when the existing client has none.
# - The separate client record the intake created is then archived.
class IntakeMergeService
  class Error < StandardError; end

  FIELD_LABELS = {
    "first_name" => "First name",
    "last_name" => "Last name",
    "date_of_birth" => "Date of birth",
    "email" => "Email",
    "phone" => "Phone",
    "mailing_address" => "Mailing address",
    "filing_status" => "Filing status",
    "is_new_client" => "New client",
    "has_prior_year_return" => "Has prior-year return",
    "changes_from_prior_year" => "Changes from prior year",
    "spouse_name" => "Spouse name",
    "spouse_dob" => "Spouse date of birth",
    "denied_eic_actc" => "Denied EIC/ACTC",
    "denied_eic_actc_year" => "Denied EIC/ACTC year",
    "has_crypto_transactions" => "Crypto transactions",
    "wants_direct_deposit" => "Wants direct deposit",
    "bank_routing_number" => "Bank routing number",
    "bank_account_number" => "Bank account number",
    "bank_account_type" => "Bank account type",
    "other_income" => "Other income",
    "comments" => "Comments"
  }.freeze

  MERGEABLE_FIELDS = FIELD_LABELS.keys.freeze
  BANK_FIELDS = {
    "bank_routing_number" => :bank_routing_number_encrypted,
    "bank_account_number" => :bank_account_number_encrypted
  }.freeze

  # Rows that belong to both a client and a return move with the return.
  CLIENT_SCOPED_RETURN_CHILDREN = [ TimeEntry, Transmittal, DailyTask, Notification ].freeze
  RETURN_CHILDREN = [ Document, IncomeSource, WorkflowEvent, IntakeSubmission ].freeze

  def self.attribute_for(field)
    BANK_FIELDS.fetch(field, field.to_sym)
  end

  def self.call(...)
    new(...).call
  end

  def initialize(submission:, user:, fields:, include_dependents: false)
    @submission = submission
    @user = user
    @fields = Array(fields).map(&:to_s).compact_blank
    @include_dependents = ActiveModel::Type::Boolean.new.cast(include_dependents) || false
  end

  def call
    unknown = @fields - MERGEABLE_FIELDS
    raise Error, "Unknown fields: #{unknown.join(', ')}" if unknown.any?

    ActiveRecord::Base.transaction do
      @submission.lock!
      raise Error, "This intake is no longer waiting for review" unless @submission.status == "needs_review"

      @intake_client = @submission.client
      @existing_client = @submission.matched_client
      raise Error, "This intake has no matched client" unless @existing_client

      changes = copy_fields
      added_dependents = copy_dependents
      target_return = move_return_work

      @intake_client.reload.archive!
      @submission.update!(
        status: "linked",
        client: @existing_client,
        tax_return: target_return,
        reviewed_by: @user,
        reviewed_at: Time.current
      )

      AuditLog.log(
        auditable: @existing_client,
        action: "updated",
        user: @user,
        changes_made: changes.presence,
        metadata: merge_summary(changes, added_dependents)
      )

      @existing_client
    end
  end

  private

  def copy_fields
    changes = {}

    @fields.each do |field|
      attribute = self.class.attribute_for(field)
      from = @existing_client.public_send(attribute)
      to = @intake_client.public_send(attribute)
      next if from == to

      @existing_client.public_send("#{attribute}=", to)
      # Bank numbers never go into the audit trail.
      changes[field] = BANK_FIELDS.key?(field) ? { from: "[hidden]", to: "[updated]" } : { from: from, to: to }
    end

    @existing_client.save! if @existing_client.changed?
    changes
  end

  def copy_dependents
    return 0 unless @include_dependents

    existing_names = @existing_client.dependents.map { |dep| dep.name.to_s.strip.downcase }
    added = 0

    @intake_client.dependents.each do |dep|
      next if existing_names.include?(dep.name.to_s.strip.downcase)

      @existing_client.dependents.create!(
        dep.attributes.except("id", "client_id", "created_at", "updated_at")
      )
      added += 1
    end

    added
  end

  def move_return_work
    intake_return = @submission.tax_return
    target_return = matching_existing_return(intake_return)

    if target_return.nil?
      intake_return.update!(client: @existing_client)
      reassign_client_scoped_rows(intake_return, intake_return)
    else
      reassign_client_scoped_rows(intake_return, target_return)
      RETURN_CHILDREN.each do |model|
        model.where(tax_return_id: intake_return.id).update_all(tax_return_id: target_return.id)
      end
      retire_folded_return(intake_return.reload, target_return)
    end

    @existing_client.update!(has_tax_returns: true) unless @existing_client.has_tax_returns
    target_return || intake_return
  end

  # The emptied intake return is removed so it doesn't linger on the returns
  # board. Its notes carry over and its row is kept in the audit log.
  def retire_folded_return(intake_return, target_return)
    if intake_return.notes.present?
      target_return.update!(notes: [ target_return.notes.presence, "From public intake: #{intake_return.notes}" ].compact.join("\n\n"))
    end

    AuditLog.log(
      auditable: intake_return,
      action: "deleted",
      user: @user,
      changes_made: intake_return.attributes.except("id"),
      metadata: "Public intake return folded into tax return ##{target_return.id} (intake ##{@submission.id})"
    )
    intake_return.destroy!
  end

  def reassign_client_scoped_rows(from_return, to_return)
    CLIENT_SCOPED_RETURN_CHILDREN.each do |model|
      model.where(tax_return_id: from_return.id)
        .update_all(tax_return_id: to_return.id, client_id: @existing_client.id)
    end
  end

  def matching_existing_return(intake_return)
    @existing_client.tax_returns
      .where(tax_year: intake_return.tax_year, return_type: "individual", form_type: %w[1040 general])
      .order(Arel.sql("CASE form_type WHEN '1040' THEN 0 WHEN 'general' THEN 1 ELSE 2 END"))
      .first
  end

  def merge_summary(changes, added_dependents)
    parts = [ "Merged public intake ##{@submission.id}" ]
    parts << "updated #{changes.keys.join(', ')}" if changes.any?
    parts << "added #{added_dependents} dependent#{'s' unless added_dependents == 1}" if added_dependents.positive?
    parts.join("; ")
  end
end
