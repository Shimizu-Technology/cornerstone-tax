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
      existing_return.update!(notes: "Prepared by staff")
      intake_return.update!(notes: "Client called about a 1099")

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
      expect(existing_return.notes).to eq("Prepared by staff\n\nFrom public intake: Client called about a 1099")

      snapshot = AuditLog.find_by!(auditable_type: "TaxReturn", auditable_id: intake_return.id, action: "deleted")
      expect(snapshot.changes_made).to include("client_id" => intake_return.client_id, "notes" => "Client called about a 1099")
      expect(snapshot.metadata).to include("folded into tax return ##{existing_return.id}")
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

  describe "time logged against the intake duplicate" do
    let(:other_client) { Client.create!(first_name: "Other", last_name: "Client", client_type: "business", business_name: "Other Co") }
    let(:staff_time_user) { create(:user, :employee) }

    def split_entry(client:, tax_return: nil, lines:)
      entry = TimeEntry.new(user: staff_time_user, work_date: Date.current - 1, entry_method: "manual", approval_status: "approved",
                            start_time: Time.zone.parse("2000-01-01 09:00"), end_time: Time.zone.parse("2000-01-01 13:00"),
                            client: client, tax_return: tax_return)
      entry.work_lines_input = lines
      entry.save!
      entry.reload
    end

    it "moves entries and their work lines to the existing client, bumping each entry's version" do
      existing_return = existing_client.tax_returns.create!(tax_year: tax_year, return_type: "individual", form_type: "1040",
                                                            source: "admin_created", workflow_stage: stage)
      submission = submit_matching_intake
      intake_client = submission.client
      intake_return = submission.tax_return
      on_return = split_entry(client: intake_client, tax_return: intake_return,
                              lines: [ { client_id: intake_client.id, description: "Intake review", minutes: 180 },
                                       { client_id: other_client.id, description: "Other work", minutes: 60 } ])
      elsewhere = split_entry(client: other_client,
                              lines: [ { client_id: other_client.id, description: "Other work", minutes: 120 },
                                       { client_id: intake_client.id, description: "Call about intake", minutes: 120 } ])
      versions = [ on_return.work_version, elsewhere.work_version ]

      post "/api/v1/intake_submissions/#{submission.id}/merge", params: { fields: [ "phone" ] }, headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      on_return.reload
      elsewhere.reload
      expect(on_return).to have_attributes(client_id: existing_client.id, tax_return_id: existing_return.id)
      expect(on_return.work_lines.map(&:client_id)).to eq([ existing_client.id, other_client.id ])
      expect(elsewhere).to have_attributes(client_id: other_client.id)
      expect(elsewhere.work_lines.map(&:client_id)).to eq([ other_client.id, existing_client.id ])
      expect([ on_return.work_version, elsewhere.work_version ].zip(versions)).to all(satisfy { |now, before| now > before })
      # Nothing is left attributed to the archived duplicate, and lines still match their entries.
      expect(TimeEntryAllocation.where(client_id: intake_client.id)).to be_empty
      expect(TimeEntry.where(client_id: intake_client.id)).to be_empty
      expect([ on_return, elsewhere ].map { |entry| entry.work_lines.sum(&:hours) }).to eq([ on_return.hours, elsewhere.hours ])
      expect(intake_client.reload).to be_archived
      expect { intake_return.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "moves the intake return's time with it when there is no existing return to fold into" do
      submission = submit_matching_intake
      intake_client = submission.client
      entry = split_entry(client: intake_client, tax_return: submission.tax_return,
                          lines: [ { client_id: intake_client.id, description: "Intake review", minutes: 240 } ])
      version = entry.work_version

      post "/api/v1/intake_submissions/#{submission.id}/merge", params: { fields: [ "phone" ] }, headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      entry.reload
      expect(entry).to have_attributes(client_id: existing_client.id, tax_return_id: submission.tax_return_id)
      expect(entry.work_lines.sole.client_id).to eq(existing_client.id)
      expect(entry.work_version).to be > version
    end

    it "refuses to hard-delete a client whose time is still attributed to it, with no FK error" do
      submission = submit_matching_intake
      intake_client = submission.client
      split_entry(client: intake_client, lines: [ { client_id: intake_client.id, minutes: 240 } ])

      expect(intake_client.destroy).to be(false)
      expect(intake_client.errors.full_messages.to_sentence).to match(/time entr/i)
      expect(TimeEntryAllocation.where(client_id: intake_client.id).count).to eq(1)
    end
  end
end
