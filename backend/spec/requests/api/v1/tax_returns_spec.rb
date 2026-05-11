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
  end
end
