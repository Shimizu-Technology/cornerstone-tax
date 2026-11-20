# frozen_string_literal: true

# Service to process client intake form submissions
# Creates: Client, Dependents, TaxReturn, IncomeSources, and IntakeSubmission snapshot
#
# The form is public, so a submission never changes an existing client. When
# the email matches a client already on file, the submission still gets its
# own client and return, and the intake is flagged "needs_review" with the
# match so staff can merge it (IntakeMergeService) or keep the two apart.
class CreateIntakeService
  INTAKE_SUBMISSION_PAYLOAD_KEYS = %i[
    first_name
    last_name
    date_of_birth
    email
    phone
    mailing_address
    filing_status
    is_new_client
    has_prior_year_return
    changes_from_prior_year
    spouse_name
    spouse_dob
    denied_eic_actc
    denied_eic_actc_year
    has_crypto_transactions
    wants_direct_deposit
    bank_account_type
    other_income
    comments
    tax_year
    signature
    signature_date
    authorization_confirmed
    dependents
    income_sources
  ].freeze

  Result = Struct.new(:success?, :client, :tax_return, :errors, keyword_init: true)

  def self.call(params)
    new(params).call
  end

  def initialize(params)
    @params = params.to_h.with_indifferent_access
    @errors = []
  end

  def call
    ActiveRecord::Base.transaction do
      create_client
      create_dependents
      create_tax_return
      create_income_sources
      create_intake_submission

      Result.new(success?: true, client: @client, tax_return: @tax_return, errors: [])
    end
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    Result.new(success?: false, client: nil, tax_return: nil, errors: @errors)
  rescue ActiveRecord::RecordNotUnique
    @errors << "A tax return for this client and tax year is already being processed. Please contact Cornerstone if you need to update your submission."
    Result.new(success?: false, client: nil, tax_return: nil, errors: @errors)
  rescue StandardError => e
    @errors << "Unexpected error: #{e.message}"
    Result.new(success?: false, client: nil, tax_return: nil, errors: @errors)
  end

  private

  def create_client
    @matched_client = find_matching_client
    @client = Client.create!(
      first_name: @params[:first_name],
      last_name: @params[:last_name],
      date_of_birth: @params[:date_of_birth],
      email: @params[:email],
      phone: @params[:phone],
      mailing_address: @params[:mailing_address],
      filing_status: @params[:filing_status],
      is_new_client: @params.fetch(:is_new_client, true),
      has_prior_year_return: @params.fetch(:has_prior_year_return, false),
      changes_from_prior_year: @params[:changes_from_prior_year],
      spouse_name: @params[:spouse_name],
      spouse_dob: @params[:spouse_dob],
      denied_eic_actc: @params.fetch(:denied_eic_actc, false),
      denied_eic_actc_year: @params[:denied_eic_actc_year],
      has_crypto_transactions: @params.fetch(:has_crypto_transactions, false),
      wants_direct_deposit: @params.fetch(:wants_direct_deposit, false),
      bank_routing_number_encrypted: @params[:bank_routing_number],
      bank_account_number_encrypted: @params[:bank_account_number],
      bank_account_type: @params[:bank_account_type],
      other_income: @params[:other_income],
      comments: @params[:comments]
    )
  end

  def create_dependents
    Array(@params[:dependents]).each do |dep_params|
      next if dep_params[:name].blank?

      @client.dependents.create!(
        name: dep_params[:name],
        date_of_birth: dep_params[:date_of_birth],
        relationship: dep_params[:relationship],
        months_lived_with_client: dep_params[:months_lived_with_client],
        is_student: dep_params.fetch(:is_student, false),
        is_disabled: dep_params.fetch(:is_disabled, false),
        can_be_claimed_by_other: dep_params.fetch(:can_be_claimed_by_other, false)
      )
    end
  end

  def create_tax_return
    initial_stage = WorkflowStage.find_by(slug: "intake_received") ||
                    WorkflowStage.active.ordered.first

    @tax_return = @client.tax_returns.create!(
      tax_year: @params[:tax_year] || Date.current.year,
      return_type: "individual",
      form_type: "1040",
      workflow_stage: initial_stage,
      source: "public_intake",
      jurisdiction: "both",
      portal_visible: true,
      documents_enabled: true,
      received_at: Time.current
    )
  end

  def create_income_sources
    Array(@params[:income_sources]).each do |source_params|
      next if source_params[:source_type].blank? && source_params[:payer_name].blank?

      @tax_return.income_sources.create!(
        source_type: source_params[:source_type],
        payer_name: source_params[:payer_name],
        notes: source_params[:notes]
      )
    end
  end

  def create_intake_submission
    IntakeSubmission.create!(
      client: @client,
      tax_return: @tax_return,
      matched_client: @matched_client,
      payload: intake_submission_payload,
      source: "public_intake",
      status: @matched_client ? "needs_review" : "received",
      submitted_at: Time.current
    )
  end

  # The client already on file with this email, if any. Records created by
  # earlier unreviewed intakes are skipped so a repeat submission points staff
  # at the original client rather than at another pending copy.
  def find_matching_client
    email = @params[:email].to_s.strip.downcase
    return nil if email.blank?

    candidates = Client.where("LOWER(email) = ?", email)
    pending_copies = IntakeSubmission.needs_review.select(:client_id)

    candidates.where.not(id: pending_copies).order(Arel.sql("archived_at IS NOT NULL"), :created_at).first ||
      candidates.order(:created_at).first
  end

  def intake_submission_payload
    @params.slice(*INTAKE_SUBMISSION_PAYLOAD_KEYS).to_h
  end
end
