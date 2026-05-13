# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::TaxReturns", type: :request do
  def auth_headers_for(user)
    {
      "Authorization" => "Bearer test-token-#{user.id}",
      "Content-Type" => "application/json"
    }
  end

  def stub_clerk_for(user)
    allow(ClerkAuth).to receive(:verify).and_return(
      {
        "sub" => user.clerk_id,
        "email" => user.email
      }
    )
  end

  def create_portal_user_for(portal_client)
    User.create!(
      clerk_id: "spec-portal-user-#{portal_client.id}",
      email: portal_client.email,
      role: "client",
      client: portal_client
    )
  end

  let!(:staff_user) do
    User.create!(
      clerk_id: "spec-tax-return-staff",
      email: "tax-return-staff@example.com",
      role: "employee",
      first_name: "Spec",
      last_name: "Staff"
    )
  end

  let!(:client) do
    Client.create!(
      first_name: "Return",
      last_name: "Client",
      email: "return-client@example.com"
    )
  end

  let!(:workflow_stage) do
    WorkflowStage.create!(
      name: "Intake Received",
      slug: "intake_received",
      position: 1,
      is_active: true
    )
  end

  describe "GET /api/v1/tax_returns" do
    it "preloads client portal users for the list response" do
      clients = 2.times.map do |index|
        Client.create!(
          first_name: "Portal",
          last_name: "Client #{index}",
          email: "portal-client-#{index}@example.com"
        )
      end
      clients.each_with_index do |portal_client, index|
        User.create!(
          clerk_id: "spec-portal-client-#{index}",
          email: portal_client.email,
          role: "client",
          client: portal_client
        )
        TaxReturn.create!(
          client: portal_client,
          tax_year: 2026,
          workflow_stage: workflow_stage
        )
      end
      stub_clerk_for(staff_user)

      user_selects = []
      subscriber = lambda do |_name, _started, _finished, _id, payload|
        sql = payload[:sql]
        user_selects << sql if sql.match?(/SELECT .*FROM "users"/)
      end

      ActiveSupport::Notifications.subscribed(subscriber, "sql.active_record") do
        get "/api/v1/tax_returns", headers: auth_headers_for(staff_user)
      end

      expect(response).to have_http_status(:ok)
      portal_user_selects = user_selects.reject { |sql| sql.include?('"clerk_id"') }
      expect(portal_user_selects.count).to eq(1)
    end
  end

  describe "GET /api/v1/tax_returns/:id" do
    it "uses preloaded document uploaders in the detail response" do
      tax_return = TaxReturn.create!(client: client, tax_year: 2026, workflow_stage: workflow_stage)
      2.times do |index|
        uploader = User.create!(
          clerk_id: "spec-document-uploader-#{index}",
          email: "document-uploader-#{index}@example.com",
          role: "employee",
          first_name: "Uploader",
          last_name: index.to_s
        )
        tax_return.documents.create!(
          filename: "document-#{index}.pdf",
          s3_key: "tax_returns/#{tax_return.id}/document-#{index}.pdf",
          uploaded_by: uploader,
          upload_source: "staff"
        )
      end
      stub_clerk_for(staff_user)

      user_selects = []
      subscriber = lambda do |_name, _started, _finished, _id, payload|
        sql = payload[:sql]
        user_selects << sql if sql.match?(/SELECT .*FROM "users"/)
      end

      ActiveSupport::Notifications.subscribed(subscriber, "sql.active_record") do
        get "/api/v1/tax_returns/#{tax_return.id}", headers: auth_headers_for(staff_user)
      end

      expect(response).to have_http_status(:ok)
      uploaded_by_names = JSON.parse(response.body).dig("tax_return", "documents").map do |document|
        document.dig("uploaded_by", "name")
      end
      expect(uploaded_by_names).to eq(["Uploader 1", "Uploader 0"])

      individual_user_lookups = user_selects.select { |sql| sql.include?('"users"."id" =') }
      expect(individual_user_lookups).to be_empty
    end
  end

  describe "POST /api/v1/tax_returns" do
    it "logs staff creation without treating the initial stage as a status change" do
      stub_clerk_for(staff_user)

      post "/api/v1/tax_returns",
           params: {
             tax_return: {
               client_id: client.id,
               tax_year: 2026,
               workflow_stage_id: workflow_stage.id
             }
           }.to_json,
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:created)
      tax_return = TaxReturn.find(JSON.parse(response.body).dig("tax_return", "id"))
      creation_event = tax_return.workflow_events.find_by!(event_type: "return_created")
      status_events = tax_return.workflow_events.where(event_type: "status_changed")

      expect(creation_event.new_value).to eq("Intake Received")
      expect(creation_event.user).to eq(staff_user)
      expect(status_events).to be_empty
    end

    it "serializes preloaded portal state after creating a return" do
      create_portal_user_for(client)
      stub_clerk_for(staff_user)

      post "/api/v1/tax_returns",
           params: {
             tax_return: {
               client_id: client.id,
               tax_year: 2027,
               workflow_stage_id: workflow_stage.id
             }
           }.to_json,
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body).dig("tax_return", "client", "has_portal_access")).to be(true)
    end

    it "creates a new client and tax return together with fee add-ons and tax outcome tracking" do
      stub_clerk_for(staff_user)

      expect do
        post "/api/v1/tax_returns",
             params: {
               tax_return: {
                 tax_year: 2026,
                 workflow_stage_id: workflow_stage.id,
                 return_type: "individual",
                 form_type: "1040",
                 base_fee_cents: 8_500,
                 fee_line_items: [
                   { label: "Schedule C", amount_cents: 4_000, notes: "Small business" },
                   { label: "Rental schedule", amount_cents: 3_000, notes: "" }
                 ],
                 discount_amount_cents: 2_000,
                 amount_paid_cents: 5_000,
                 tax_outcome_status: "tax_due",
                 tax_outcome_amount_cents: 42_000,
                 tax_outcome_notes: "Needs check before filing",
                 client_attributes: {
                   client_type: "individual",
                   first_name: "Walk",
                   last_name: "In",
                   phone: "6715550101",
                   filing_status: "single"
                 }
               }
             }.to_json,
             headers: auth_headers_for(staff_user)
      end.to change(Client, :count).by(1).and change(TaxReturn, :count).by(1)

      expect(response).to have_http_status(:created)
      payload = JSON.parse(response.body).fetch("tax_return")
      expect(payload.dig("client", "full_name")).to eq("Walk In")
      expect(payload.fetch("fee_line_items_total_cents")).to eq(7_000)
      expect(payload.fetch("final_fee_cents")).to eq(13_500)
      expect(payload.fetch("balance_due_cents")).to eq(8_500)
      expect(payload.fetch("tax_outcome_status")).to eq("tax_due")
      expect(payload.fetch("tax_outcome_amount_cents")).to eq(42_000)
    end

    it "rolls back the return if the creation audit event cannot be written" do
      invalid_event = WorkflowEvent.new
      invalid_event.valid?
      allow_any_instance_of(Api::V1::TaxReturnsController).to receive(:log_return_created_event).and_raise(
        ActiveRecord::RecordInvalid.new(invalid_event)
      )
      stub_clerk_for(staff_user)

      expect do
        post "/api/v1/tax_returns",
             params: {
               tax_return: {
                 client_id: client.id,
                 tax_year: 2028,
                 workflow_stage_id: workflow_stage.id
               }
             }.to_json,
             headers: auth_headers_for(staff_user)
      end.not_to change(TaxReturn, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns a validation error when a concurrent create hits the unique index" do
      allow_any_instance_of(TaxReturn).to receive(:save!).and_raise(
        ActiveRecord::RecordNotUnique.new("duplicate key value violates unique constraint")
      )
      stub_clerk_for(staff_user)

      expect do
        post "/api/v1/tax_returns",
             params: {
               tax_return: {
                 client_id: client.id,
                 tax_year: 2029,
                 workflow_stage_id: workflow_stage.id
               }
             }.to_json,
             headers: auth_headers_for(staff_user)
      end.not_to change(TaxReturn, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).fetch("errors")).to include(
        "A tax return with these client, year, return type, and form details already exists"
      )
    end
  end

  describe "PATCH /api/v1/tax_returns/:id" do
    it "serializes preloaded portal state after updating a return" do
      create_portal_user_for(client)
      tax_return = TaxReturn.create!(client: client, tax_year: 2026, workflow_stage: workflow_stage)
      stub_clerk_for(staff_user)

      patch "/api/v1/tax_returns/#{tax_return.id}",
            params: {
              tax_return: {
                priority: "high"
              }
            }.to_json,
            headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("tax_return", "client", "has_portal_access")).to be(true)
    end
  end

  describe "POST /api/v1/tax_returns/:id/assign" do
    it "serializes preloaded portal state after assigning a return" do
      create_portal_user_for(client)
      assignee = User.create!(
        clerk_id: "spec-tax-return-assignee",
        email: "tax-return-assignee@example.com",
        role: "employee",
        first_name: "Spec",
        last_name: "Assignee"
      )
      tax_return = TaxReturn.create!(client: client, tax_year: 2026, workflow_stage: workflow_stage)
      stub_clerk_for(staff_user)

      post "/api/v1/tax_returns/#{tax_return.id}/assign",
           params: {
             user_id: assignee.id
           }.to_json,
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("tax_return", "client", "has_portal_access")).to be(true)
    end
  end
end
