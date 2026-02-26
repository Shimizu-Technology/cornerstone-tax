# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::AuditLogs", type: :request do
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
      clerk_id: "spec-admin-audit-logs-request",
      email: "admin-audit-logs-request@example.com",
      role: "admin",
      first_name: "Spec",
      last_name: "Admin"
    )
  end

  let!(:client_a) do
    Client.create!(
      first_name: "Client",
      last_name: "Alpha",
      email: "client-alpha-audit-logs-request@example.com"
    )
  end

  let!(:client_b) do
    Client.create!(
      first_name: "Client",
      last_name: "Beta",
      email: "client-beta-audit-logs-request@example.com"
    )
  end

  let!(:template) do
    OperationTemplate.create!(
      name: "Audit Logs Request Template #{SecureRandom.hex(4)}",
      category: "general",
      recurrence_type: "monthly",
      auto_generate: true,
      created_by: admin
    )
  end

  let!(:template_task) do
    template.operation_template_tasks.create!(title: "Reconcile payroll", position: 1)
  end

  let!(:cycle_a) do
    OperationCycle.create!(
      client: client_a,
      operation_template: template,
      period_start: Date.current.beginning_of_month,
      period_end: Date.current.end_of_month,
      cycle_label: "Client A Run",
      generation_mode: "manual",
      status: "active",
      generated_by: admin
    )
  end

  let!(:cycle_b) do
    OperationCycle.create!(
      client: client_b,
      operation_template: template,
      period_start: Date.current.beginning_of_month,
      period_end: Date.current.end_of_month,
      cycle_label: "Client B Run",
      generation_mode: "manual",
      status: "active",
      generated_by: admin
    )
  end

  let!(:task_a) do
    OperationTask.create!(
      operation_cycle: cycle_a,
      operation_template_task: template_task,
      client: client_a,
      title: "Client A checklist task",
      position: 1,
      status: "not_started",
      evidence_required: false
    )
  end

  let!(:task_b) do
    OperationTask.create!(
      operation_cycle: cycle_b,
      operation_template_task: template_task,
      client: client_b,
      title: "Client B checklist task",
      position: 1,
      status: "not_started",
      evidence_required: false
    )
  end

  before do
    AuditLog.log(auditable: client_a, action: "updated", user: admin, metadata: "Updated client A")
    AuditLog.log(auditable: task_a, action: "updated", user: admin, metadata: "Updated task A")
    AuditLog.log(auditable: task_b, action: "updated", user: admin, metadata: "Updated task B")
  end

  describe "GET /api/v1/audit_logs" do
    it "includes client-scoped checklist task logs when filtering by client_id" do
      stub_clerk_for(admin)
      get "/api/v1/audit_logs", params: { client_id: client_a.id }, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      log_ids = body.fetch("audit_logs").map { |log| log.fetch("id") }

      expect(log_ids).to include(AuditLog.find_by(auditable: client_a)&.id)
      expect(log_ids).to include(AuditLog.find_by(auditable: task_a)&.id)
      expect(log_ids).not_to include(AuditLog.find_by(auditable: task_b)&.id)
    end
  end
end
