# frozen_string_literal: true

# Service to process client intake form submissions
# Creates: Client, Dependents, TaxReturn, IncomeSources, and IntakeSubmission snapshot
class CreateIntakeService
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
  rescue StandardError => e
    @errors << "Unexpected error: #{e.message}"
    Result.new(success?: false, client: nil, tax_return: nil, errors: @errors)
  end

  private

  def create_client
    @client = find_existing_client
    attrs = {
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
    }

    if @client
      @client.update!(attrs)
    else
      @client = Client.create!(attrs)
    end
  end

  def create_dependents
    return unless @params[:dependents].present?

    @client.dependents.destroy_all

    @params[:dependents].each do |dep_params|
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

    tax_year = @params[:tax_year] || Date.current.year

    @tax_return = @client.tax_returns.find_or_initialize_by(
      tax_year: tax_year,
      return_type: "individual",
      form_type: "general"
    )

    @tax_return.assign_attributes(
      workflow_stage: @tax_return.workflow_stage || initial_stage,
      source: @tax_return.new_record? ? "public_intake" : @tax_return.source,
      jurisdiction: @tax_return.new_record? ? "both" : @tax_return.jurisdiction,
      portal_visible: @tax_return.new_record? ? true : @tax_return.portal_visible,
      documents_enabled: @tax_return.new_record? ? true : @tax_return.documents_enabled,
      received_at: @tax_return.received_at || Time.current
    )
    @tax_return.save!
  end

  def create_income_sources
    return unless @params[:income_sources].present?

    @tax_return.income_sources.destroy_all

    @params[:income_sources].each do |source_params|
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
      payload: @params.except(:bank_routing_number, :bank_account_number).to_h,
      source: "public_intake",
      status: "received",
      submitted_at: Time.current
    )
  end

  def find_existing_client
    email = @params[:email].to_s.strip.downcase
    return nil if email.blank?

    Client.active.find_by("LOWER(email) = ?", email)
  end
end
