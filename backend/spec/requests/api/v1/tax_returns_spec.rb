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
    it "creates one status audit event for the initial workflow stage" do
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
      status_events = tax_return.workflow_events.where(event_type: "status_changed")

      expect(status_events.count).to eq(1)
      expect(status_events.first.new_value).to eq("Intake Received")
      expect(status_events.first.user).to eq(staff_user)
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
