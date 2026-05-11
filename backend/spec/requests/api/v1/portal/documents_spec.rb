# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Portal::Documents", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  let(:client) do
    Client.create!(
      first_name: "Portal",
      last_name: "Client",
      email: "portal-client@example.com"
    )
  end

  let(:client_user) do
    create(
      :user,
      email: "portal-user@example.com",
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
      email: "portal-uploader-#{index}@example.com",
      role: "employee",
      first_name: "Uploader",
      last_name: index.to_s
    )
    tax_return.documents.create!(
      filename: "portal-document-#{index}.pdf",
      s3_key: "tax_returns/#{tax_return.id}/portal-document-#{index}.pdf",
      uploaded_by: uploader,
      upload_source: "staff"
    )
  end

  describe "GET /api/v1/portal/tax_returns/:tax_return_id/documents" do
    it "preloads uploaders for the document list response" do
      create_uploaded_document(0)
      create_uploaded_document(1)

      user_selects = user_selects_for_request do
        get "/api/v1/portal/tax_returns/#{tax_return.id}/documents",
            headers: auth_headers_for(client_user)
      end

      expect(response).to have_http_status(:ok)
      uploader_names = JSON.parse(response.body).fetch("documents").map { |document| document["uploaded_by"] }
      expect(uploader_names).to eq(["Uploader 1", "Uploader 0"])

      individual_user_lookups = user_selects.select { |sql| sql.include?('"users"."id" =') }
      expect(individual_user_lookups.count).to eq(1)
    end
  end

  describe "POST /api/v1/portal/tax_returns/:tax_return_id/documents" do
    it "still registers the document when notification enqueueing fails" do
      allow(S3Service).to receive(:configured?).and_return(true)
      allow(S3Service).to receive(:object_exists?).and_return(true)
      allow(DocumentUploadNotificationJob).to receive(:perform_later).and_raise(
        ActiveRecord::StatementInvalid.new("solid_queue_jobs does not exist")
      )

      post "/api/v1/portal/tax_returns/#{tax_return.id}/documents",
           params: {
             document: {
               filename: "w2.pdf",
               s3_key: "tax_returns/#{tax_return.id}/w2.pdf",
               content_type: "application/pdf",
               file_size: 1024,
               document_type: "w2"
             }
           },
           headers: auth_headers_for(client_user)

      expect(response).to have_http_status(:created)
      expect(tax_return.documents.count).to eq(1)

      document = tax_return.documents.first
      expect(document.filename).to eq("w2.pdf")
      expect(document.uploaded_by).to eq(client_user)
      expect(document.upload_source).to eq("client")
    end
  end
end
