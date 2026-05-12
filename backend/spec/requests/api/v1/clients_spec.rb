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
    it "logs quick-created tax returns without treating the initial stage as a status change" do
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
      creation_event = tax_return.workflow_events.find_by!(event_type: "return_created")
      status_events = tax_return.workflow_events.where(event_type: "status_changed")

      expect(creation_event.new_value).to eq(workflow_stage.name)
      expect(creation_event.user).to eq(staff_user)
      expect(status_events).to be_empty
    end

    it "rolls back quick-created clients and tax returns if the creation audit event fails" do
      invalid_event = WorkflowEvent.new
      invalid_event.valid?
      allow_any_instance_of(Api::V1::ClientsController).to receive(:log_return_created_event).and_raise(
        ActiveRecord::RecordInvalid.new(invalid_event)
      )

      expect do
        post "/api/v1/clients",
             params: {
               client: {
                 first_name: "Rollback",
                 last_name: "Client",
                 email: "rollback-client@example.com",
                 has_tax_returns: true,
                 tax_year: 2026
               }
             },
             headers: auth_headers_for(staff_user)
      end.not_to change(Client, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(TaxReturn.where(tax_year: 2026).count).to eq(0)
    end
  end
end
