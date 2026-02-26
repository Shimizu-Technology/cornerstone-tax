# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Clients", type: :request do
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

  let!(:admin) do
    User.create!(
      clerk_id: "spec-admin-clients-request",
      email: "admin-clients-request@example.com",
      role: "admin",
      first_name: "Spec",
      last_name: "Admin"
    )
  end

  let!(:employee) do
    User.create!(
      clerk_id: "spec-employee-clients-request",
      email: "employee-clients-request@example.com",
      role: "employee",
      first_name: "Spec",
      last_name: "Employee"
    )
  end

  let!(:client) do
    Client.create!(
      first_name: "Archive",
      last_name: "Target",
      email: "archive-target@example.com"
    )
  end

  let!(:template) do
    OperationTemplate.create!(
      name: "Archive Flow Template #{SecureRandom.hex(4)}",
      category: "general",
      recurrence_type: "monthly",
      auto_generate: true,
      created_by: admin
    )
  end

  let!(:assignment) do
    ClientOperationAssignment.create!(
      client: client,
      operation_template: template,
      assignment_status: "active",
      auto_generate: true,
      created_by: admin
    )
  end

  let!(:cycle) do
    OperationCycle.create!(
      client: client,
      operation_template: template,
      client_operation_assignment: assignment,
      period_start: Date.current.beginning_of_month,
      period_end: Date.current.end_of_month,
      cycle_label: "Archive Spec Cycle",
      generation_mode: "manual",
      status: "active",
      generated_by: admin
    )
  end

  describe "GET /api/v1/clients" do
    it "excludes archived clients by default" do
      client.update!(archived_at: Time.current)
      stub_clerk_for(employee)

      get "/api/v1/clients", headers: auth_headers_for(employee)

      expect(response).to have_http_status(:ok)
      ids = JSON.parse(response.body).fetch("clients").map { |item| item["id"] }
      expect(ids).not_to include(client.id)
    end

    it "returns archived clients when requested" do
      client.update!(archived_at: Time.current)
      stub_clerk_for(employee)

      get "/api/v1/clients?archived=true", headers: auth_headers_for(employee)

      expect(response).to have_http_status(:ok)
      ids = JSON.parse(response.body).fetch("clients").map { |item| item["id"] }
      expect(ids).to include(client.id)
    end
  end

  describe "POST /api/v1/clients" do
    it "creates a client audit log entry" do
      stub_clerk_for(admin)

      post "/api/v1/clients",
           params: {
             client: {
               first_name: "Log",
               last_name: "Check",
               email: "log-check@example.com"
             }
           }.to_json,
           headers: auth_headers_for(admin)

      expect(response).to have_http_status(:created)
      created_client_id = JSON.parse(response.body).dig("client", "id")
      created_log = AuditLog.where(auditable_type: "Client", auditable_id: created_client_id).order(created_at: :desc).first
      expect(created_log).to be_present
      expect(created_log.action).to eq("created")
    end
  end

  describe "PATCH /api/v1/clients/:id/archive" do
    it "archives client and pauses checklist activity for admin" do
      stub_clerk_for(admin)

      patch "/api/v1/clients/#{client.id}/archive", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      client.reload
      assignment.reload
      cycle.reload
      expect(client.archived_at).to be_present
      expect(assignment.assignment_status).to eq("paused")
      expect(cycle.status).to eq("cancelled")
    end

    it "rejects non-admin users" do
      stub_clerk_for(employee)

      patch "/api/v1/clients/#{client.id}/archive", headers: auth_headers_for(employee)

      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)["error"]).to eq("Admin access required")
    end
  end

  describe "PATCH /api/v1/clients/:id/unarchive" do
    it "unarchives client and keeps plans paused" do
      client.update!(archived_at: Time.current)
      assignment.update!(assignment_status: "paused")
      stub_clerk_for(admin)

      patch "/api/v1/clients/#{client.id}/unarchive", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      client.reload
      assignment.reload
      expect(client.archived_at).to be_nil
      expect(assignment.assignment_status).to eq("paused")
    end
  end
end
