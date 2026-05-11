# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Clients", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  let(:staff_user) { create(:user, :employee) }
  let!(:workflow_stage) do
    WorkflowStage.create!(
      name: "Intake Received",
      slug: "intake_received",
      position: 1,
      is_active: true
    )
  end

  describe "POST /api/v1/clients" do
    it "creates one status audit event for the quick-created tax return" do
      post "/api/v1/clients",
           params: {
             client: {
               first_name: "Quick",
               last_name: "Client",
               email: "quick-client@example.com",
               has_tax_returns: true,
               tax_year: 2026
             }
           },
           headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:created)
      tax_return = Client.find_by!(email: "quick-client@example.com").tax_returns.sole
      status_events = tax_return.workflow_events.where(event_type: "status_changed")

      expect(status_events.count).to eq(1)
      expect(status_events.first.new_value).to eq(workflow_stage.name)
      expect(status_events.first.user).to eq(staff_user)
    end
  end
end
