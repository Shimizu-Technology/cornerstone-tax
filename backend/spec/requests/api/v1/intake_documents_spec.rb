# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::IntakeDocuments", type: :request do
  let!(:stage) { WorkflowStage.create!(name: "Intake Received", slug: "intake_received", position: 1) }

  def submit_intake
    post "/api/v1/intake",
         params: {
           intake: {
             first_name: "Intake",
             last_name: "Client",
             date_of_birth: "1990-01-01",
             email: "intake-docs@example.com",
             phone: "671-555-0100",
             mailing_address: "123 Test Street",
             filing_status: "single",
             signature: "Intake Client",
             signature_date: Date.current.iso8601,
             authorization_confirmed: true
           }
         }
  end

  describe "POST /api/v1/intake" do
    it "returns a signed document upload token" do
      submit_intake

      expect(response).to have_http_status(:created)
      payload = JSON.parse(response.body)
      token = payload.dig("document_upload", "upload_token")

      expect(token).to be_present
      expect(TaxReturn.find_signed!(token, purpose: :intake_document_upload)).to eq(TaxReturn.last)
    end
  end

  describe "POST /api/v1/intake_documents/presign" do
    it "rejects invalid upload tokens" do
      post "/api/v1/intake_documents/presign",
           params: {
             upload_token: "not-valid",
             filename: "w2.pdf",
             content_type: "application/pdf",
             file_size: 1024
           }

      expect(response).to have_http_status(:not_found)
    end

    it "returns a presigned upload URL for valid intake tokens" do
      submit_intake
      token = JSON.parse(response.body).dig("document_upload", "upload_token")

      allow(S3Service).to receive(:configured?).and_return(true)
      allow(S3Service).to receive(:presign_upload).and_return(
        { url: "https://s3.example/upload", s3_key: "tax_returns/#{TaxReturn.last.id}/w2.pdf" }
      )

      post "/api/v1/intake_documents/presign",
           params: {
             upload_token: token,
             filename: "w2.pdf",
             content_type: "application/pdf",
             file_size: 1024
           }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to include(
        "upload_url" => "https://s3.example/upload",
        "s3_key" => "tax_returns/#{TaxReturn.last.id}/w2.pdf"
      )
    end
  end

  describe "POST /api/v1/intake_documents" do
    it "registers uploaded documents against the intake tax return" do
      submit_intake
      token = JSON.parse(response.body).dig("document_upload", "upload_token")
      tax_return = TaxReturn.last

      allow(S3Service).to receive(:configured?).and_return(true)
      allow(S3Service).to receive(:object_exists?).and_return(true)

      post "/api/v1/intake_documents",
           params: {
             upload_token: token,
             document: {
               filename: "w2.pdf",
               s3_key: "tax_returns/#{tax_return.id}/w2.pdf",
               content_type: "application/pdf",
               file_size: 1024,
               document_type: "w2"
             }
           }

      expect(response).to have_http_status(:created)
      expect(tax_return.documents.count).to eq(1)
      expect(tax_return.documents.first.filename).to eq("w2.pdf")
      expect(tax_return.documents.first.upload_source).to eq("intake")
      expect(JSON.parse(response.body).dig("document", "uploaded_by_source")).to eq("intake")
    end

    it "still registers the document when notification enqueueing fails" do
      submit_intake
      token = JSON.parse(response.body).dig("document_upload", "upload_token")
      tax_return = TaxReturn.last

      allow(S3Service).to receive(:configured?).and_return(true)
      allow(S3Service).to receive(:object_exists?).and_return(true)
      allow(DocumentUploadNotificationJob).to receive(:perform_later).and_raise(
        ActiveRecord::StatementInvalid.new("solid_queue_jobs does not exist")
      )

      post "/api/v1/intake_documents",
           params: {
             upload_token: token,
             document: {
               filename: "1099.pdf",
               s3_key: "tax_returns/#{tax_return.id}/1099.pdf",
               content_type: "application/pdf",
               file_size: 2048,
               document_type: "1099"
             }
           }

      expect(response).to have_http_status(:created)
      expect(tax_return.documents.count).to eq(1)
      expect(tax_return.documents.first.filename).to eq("1099.pdf")
    end

    it "rejects registration when S3 cannot verify the uploaded object" do
      submit_intake
      token = JSON.parse(response.body).dig("document_upload", "upload_token")
      tax_return = TaxReturn.last

      allow(S3Service).to receive(:configured?).and_return(true)
      allow(S3Service).to receive(:object_exists?).and_return(false)

      post "/api/v1/intake_documents",
           params: {
             upload_token: token,
             document: {
               filename: "w2.pdf",
               s3_key: "tax_returns/#{tax_return.id}/w2.pdf",
               content_type: "application/pdf",
               file_size: 1024,
               document_type: "w2"
             }
           }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Document.count).to eq(0)
    end

    it "rejects S3 keys outside the signed tax return scope" do
      submit_intake
      token = JSON.parse(response.body).dig("document_upload", "upload_token")

      post "/api/v1/intake_documents",
           params: {
             upload_token: token,
             document: {
               filename: "w2.pdf",
               s3_key: "tax_returns/999999/w2.pdf",
               content_type: "application/pdf",
               file_size: 1024,
               document_type: "w2"
             }
           }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Document.count).to eq(0)
    end
  end
end
