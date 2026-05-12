# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portal::TaxReturns", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  let(:client) do
    Client.create!(
      first_name: "Portal",
      last_name: "Client",
      email: "portal-tax-return-client@example.com"
    )
  end

  let(:client_user) do
    create(
      :user,
      email: "portal-tax-return-user@example.com",
      role: "client",
      client: client
    )
  end

  let(:tax_return) { TaxReturn.create!(client: client, tax_year: 2026, portal_visible: true) }

  def user_selects_for_request
    user_selects = []
    subscriber = lambda do |_name, _started, _finished, _id, payload|
      sql = payload[:sql]
      user_selects << sql if sql.match?(/SELECT .*FROM "users"/)
    end

    ActiveSupport::Notifications.subscribed(subscriber, "sql.active_record") do
      yield
    end

    user_selects
  end

  def create_uploaded_document(index)
    uploader = create(
      :user,
      email: "portal-return-uploader-#{index}@example.com",
      role: "employee",
      first_name: "Uploader",
      last_name: index.to_s
    )
    tax_return.documents.create!(
      filename: "portal-return-document-#{index}.pdf",
      s3_key: "tax_returns/#{tax_return.id}/portal-return-document-#{index}.pdf",
      uploaded_by: uploader,
      upload_source: "staff"
    )
  end

  describe "GET /api/v1/portal/tax_returns/:id" do
    it "includes client-facing portal flags in the detail response" do
      tax_return.update!(documents_enabled: false, signature_status: "requested")

      get "/api/v1/portal/tax_returns/#{tax_return.id}",
          headers: auth_headers_for(client_user)

      expect(response).to have_http_status(:ok)
      payload = JSON.parse(response.body).fetch("tax_return")
      expect(payload).to include(
        "documents_enabled" => false,
        "signature_status" => "requested"
      )
    end

    it "preloads document uploaders for the detail response" do
      create_uploaded_document(0)
      create_uploaded_document(1)

      user_selects = user_selects_for_request do
        get "/api/v1/portal/tax_returns/#{tax_return.id}",
            headers: auth_headers_for(client_user)
      end

      expect(response).to have_http_status(:ok)
      uploader_names = JSON.parse(response.body).dig("tax_return", "documents").map { |document| document["uploaded_by"] }
      expect(uploader_names).to eq(["Uploader 1", "Uploader 0"])

      individual_user_lookups = user_selects.select { |sql| sql.include?('"users"."id" =') }
      expect(individual_user_lookups.count).to eq(1)
    end
  end
end
