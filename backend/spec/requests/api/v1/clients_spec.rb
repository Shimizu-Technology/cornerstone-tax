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

  describe "GET /api/v1/clients/:id" do
    it "uses preloaded tax return child associations in the detail response" do
      client = Client.create!(
        first_name: "Detail",
        last_name: "Client",
        email: "detail-client@example.com"
      )

      2.times do |index|
        tax_return = client.tax_returns.create!(
          tax_year: 2026 - index,
          workflow_stage: workflow_stage,
          created_at: index.days.ago
        )
        tax_return.income_sources.create!(
          source_type: "w2",
          payer_name: "Employer #{index}"
        )
        tax_return.workflow_events.create!(
          event_type: "note_added",
          description: "Event #{index}",
          created_at: index.minutes.ago
        )
      end

      child_selects = []
      subscriber = lambda do |_name, _started, _finished, _id, payload|
        sql = payload[:sql]
        child_selects << sql if sql.match?(/SELECT .*FROM "(income_sources|workflow_events)"/)
      end

      ActiveSupport::Notifications.subscribed(subscriber, "sql.active_record") do
        get "/api/v1/clients/#{client.id}", headers: auth_headers_for(staff_user)
      end

      expect(response).to have_http_status(:ok)
      returns = JSON.parse(response.body).dig("client", "tax_returns")
      expect(returns.flat_map { |tax_return| tax_return.fetch("income_sources") }
                    .map { |source| source.fetch("payer_name") }).to match_array(["Employer 0", "Employer 1"])
      expect(returns.flat_map { |tax_return| tax_return.fetch("workflow_events") }
                    .map { |event| event.fetch("description") }).to match_array(["Event 0", "Event 1"])

      individual_child_lookups = child_selects.select do |sql|
        sql.include?('"income_sources"."tax_return_id" =') ||
          sql.include?('"workflow_events"."tax_return_id" =')
      end
      expect(individual_child_lookups).to be_empty
    end
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

    it "returns a validation error when a concurrent tax return create hits the unique index" do
      allow_any_instance_of(TaxReturn).to receive(:save!).and_raise(
        ActiveRecord::RecordNotUnique.new("duplicate key value violates unique constraint")
      )

      expect do
        post "/api/v1/clients",
             params: {
               client: {
                 first_name: "Duplicate",
                 last_name: "Client",
                 email: "duplicate-client@example.com",
                 has_tax_returns: true,
                 tax_year: 2026
               }
             },
             headers: auth_headers_for(staff_user)
      end.not_to change(Client, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).fetch("errors")).to include(
        "A tax return with these client, year, return type, and form details already exists"
      )
    end
  end
end
