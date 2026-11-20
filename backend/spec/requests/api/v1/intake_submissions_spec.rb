# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::IntakeSubmissions", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  let!(:stage) { WorkflowStage.create!(name: "Intake Received", slug: "intake_received", position: 1) }
  let(:staff_user) { create(:user, :employee) }
  let(:tax_year) { Date.current.year }

  let!(:existing_client) do
    Client.create!(
      first_name: "Original",
      last_name: "Owner",
      email: "match@example.com",
      phone: "671-555-0199",
      bank_routing_number_encrypted: "123456789",
      bank_account_number_encrypted: "987654321"
    )
  end

  def submit_matching_intake(overrides = {})
    post "/api/v1/intake",
         params: {
           intake: {
             first_name: "Original",
             last_name: "Owner",
             email: "match@example.com",
             phone: "671-555-0000",
             mailing_address: "456 New Street",
             tax_year: tax_year,
             bank_routing_number: "111000025",
             bank_account_number: "555555555",
             dependents: [ { name: "Submitted Kid", relationship: "Child" } ],
             income_sources: [ { source_type: "w2", payer_name: "Submitted Employer" } ]
           }.merge(overrides)
         }
    IntakeSubmission.order(:id).last
  end

  def json
    JSON.parse(response.body)
  end

  describe "access" do
    it "requires a signed-in staff user" do
      submission = submit_matching_intake

      get "/api/v1/intake_submissions/#{submission.id}"
      expect(response).to have_http_status(:unauthorized)

      portal_user = create(:user, role: "client")
      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [ "phone" ] },
           headers: auth_headers_for(portal_user)
      expect(response).to have_http_status(:forbidden)
      expect(existing_client.reload.phone).to eq("671-555-0199")
    end
  end

  describe "GET /api/v1/intake_submissions" do
    it "lists intakes waiting for review with both clients" do
      submission = submit_matching_intake
      submit_matching_intake(email: "unrelated@example.com")

      get "/api/v1/intake_submissions", headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(json["intake_submissions"].map { |row| row["id"] }).to eq([ submission.id ])
      expect(json["intake_submissions"].first.dig("matched_client", "id")).to eq(existing_client.id)
    end
  end

  describe "GET /api/v1/intake_submissions/:id" do
    it "compares submitted and existing values with bank numbers masked" do
      submission = submit_matching_intake

      get "/api/v1/intake_submissions/#{submission.id}", headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      fields = json.dig("intake_submission", "fields").index_by { |field| field["key"] }
      expect(fields["phone"]).to include("submitted" => "671-555-0000", "existing" => "671-555-0199", "differs" => true)
      expect(fields["bank_account_number"]).to include("submitted" => "••••5555", "existing" => "••••4321", "differs" => true)
      expect(response.body).not_to include("555555555")
      expect(response.body).not_to include("987654321")
      expect(json.dig("intake_submission", "submitted_dependents").map { |dep| dep["name"] }).to eq([ "Submitted Kid" ])
    end
  end

  describe "POST /api/v1/intake_submissions/:id/merge" do
    it "copies only the selected fields and moves the intake return to the existing client" do
      submission = submit_matching_intake
      intake_client = submission.client
      intake_return = submission.tax_return

      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [ "phone", "bank_account_number" ], include_dependents: true },
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      existing_client.reload
      expect(existing_client.phone).to eq("671-555-0000")
      expect(existing_client.bank_account_number_encrypted).to eq("555555555")
      expect(existing_client.bank_routing_number_encrypted).to eq("123456789")
      expect(existing_client.mailing_address).to be_nil
      expect(existing_client.dependents.pluck(:name)).to eq([ "Submitted Kid" ])
      expect(intake_return.reload.client).to eq(existing_client)
      expect(intake_client.reload).to be_archived
      expect(submission.reload).to have_attributes(
        status: "linked",
        client: existing_client,
        tax_return: intake_return,
        reviewed_by: staff_user
      )

      audit = AuditLog.where(auditable: existing_client).last
      expect(audit.changes_made.keys).to contain_exactly("phone", "bank_account_number")
      expect(audit.changes_made.to_json).not_to include("555555555")
    end

    it "folds the intake into the existing client's return for that year" do
      existing_return = existing_client.tax_returns.create!(
        tax_year: tax_year, return_type: "individual", form_type: "1040",
        source: "admin_created", workflow_stage: stage
      )
      existing_return.income_sources.create!(source_type: "w2", payer_name: "Existing Employer")
      submission = submit_matching_intake
      intake_return = submission.tax_return
      document = intake_return.documents.create!(filename: "w2.pdf", s3_key: "tax_returns/#{intake_return.id}/w2.pdf", upload_source: "intake")

      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [] },
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(TaxReturn.exists?(intake_return.id)).to be(false)
      expect(existing_return.reload.income_sources.pluck(:payer_name)).to contain_exactly("Existing Employer", "Submitted Employer")
      expect(document.reload.tax_return).to eq(existing_return)
      expect(submission.reload.tax_return).to eq(existing_return)
      expect(existing_client.reload.phone).to eq("671-555-0199")
      expect(existing_client.dependents).to be_empty
    end

    it "does not add a submitted dependent the existing client already has" do
      existing_client.dependents.create!(name: "submitted kid", relationship: "Son")
      submission = submit_matching_intake

      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [], include_dependents: true },
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(existing_client.dependents.reload.pluck(:relationship)).to eq([ "Son" ])
    end

    it "rejects unknown fields and intakes that were already reviewed" do
      submission = submit_matching_intake

      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [ "archived_at" ] },
           headers: auth_headers_for(staff_user)
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/intake_submissions/#{submission.id}/keep_separate", headers: auth_headers_for(staff_user)
      expect(response).to have_http_status(:ok)

      post "/api/v1/intake_submissions/#{submission.id}/merge",
           params: { fields: [ "phone" ] },
           headers: auth_headers_for(staff_user)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(existing_client.reload.phone).to eq("671-555-0199")
    end
  end

  describe "POST /api/v1/intake_submissions/:id/keep_separate" do
    it "clears the review flag and leaves both clients as they are" do
      submission = submit_matching_intake

      post "/api/v1/intake_submissions/#{submission.id}/keep_separate", headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(submission.reload).to have_attributes(status: "reviewed", reviewed_by: staff_user)
      expect(submission.client).not_to be_archived
      expect(existing_client.reload.phone).to eq("671-555-0199")
    end
  end

  describe "client endpoints" do
    it "flags both clients until the intake is reviewed" do
      submission = submit_matching_intake

      get "/api/v1/clients/#{existing_client.id}", headers: auth_headers_for(staff_user)
      expect(json.dig("client", "intake_reviews")).to eq([
        { "id" => submission.id, "submitted_at" => submission.submitted_at.as_json, "role" => "existing",
          "other_client" => { "id" => submission.client_id, "full_name" => "Original Owner" } }
      ])

      get "/api/v1/clients", params: { search: "match@" }, headers: auth_headers_for(staff_user)
      expect(json["clients"].map { |client| client["needs_intake_review"] }).to eq([ true, true ])

      post "/api/v1/intake_submissions/#{submission.id}/keep_separate", headers: auth_headers_for(staff_user)

      get "/api/v1/clients/#{submission.client_id}", headers: auth_headers_for(staff_user)
      expect(json.dig("client", "intake_reviews")).to eq([])
    end
  end
end
