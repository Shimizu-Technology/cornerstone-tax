# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::IntakeDocuments", type: :request do
  let!(:stage) { WorkflowStage.create!(name: "Intake Received", slug: "intake_received", position: 1) }

  def submit_intake(overrides = {})
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
           }.merge(overrides)
         }
  end

  describe "POST /api/v1/intake" do
    it "returns a signed document upload token" do
      submit_intake

      expect(response).to have_http_status(:created)
      payload = JSON.parse(response.body)
      token = payload.dig("document_upload", "upload_token")

      expect(token).to be_present
      tax_return = TaxReturn.find_signed!(token, purpose: :intake_document_upload)
      status_events = tax_return.workflow_events.where(event_type: "status_changed")

      expect(tax_return).to eq(TaxReturn.last)
      expect(status_events).to be_empty
    end

    it "creates a new client, return, and plain intake for a genuinely new email" do
      expect do
        submit_intake(
          dependents: [ { name: "New Kid", relationship: "Child" } ],
          income_sources: [ { source_type: "w2", payer_name: "New Employer" } ]
        )
      end.to change(Client, :count).by(1).and change(TaxReturn, :count).by(1)

      expect(response).to have_http_status(:created)
      payload = JSON.parse(response.body)
      client = Client.find(payload.dig("client", "id"))
      tax_return = TaxReturn.find_signed!(payload.dig("document_upload", "upload_token"), purpose: :intake_document_upload)
      submission = client.intake_submissions.sole

      expect(client.email).to eq("intake-docs@example.com")
      expect(client.dependents.pluck(:name)).to eq([ "New Kid" ])
      expect(tax_return.client).to eq(client)
      expect(tax_return.source).to eq("public_intake")
      expect(tax_return.income_sources.pluck(:payer_name)).to eq([ "New Employer" ])
      expect(submission.status).to eq("received")
      expect(submission.matched_client).to be_nil
    end

    context "when the email matches an existing client" do
      let!(:existing_client) do
        Client.create!(
          first_name: "Original",
          last_name: "Owner",
          email: "Intake-Docs@Example.com",
          phone: "671-555-0199",
          spouse_name: "Former Spouse",
          bank_routing_number_encrypted: "123456789",
          bank_account_number_encrypted: "987654321",
          bank_account_type: "checking"
        )
      end
      let!(:existing_return) do
        existing_client.tax_returns.create!(
          tax_year: Date.current.year,
          workflow_stage: stage,
          return_type: "individual",
          form_type: "1040",
          source: "admin_created",
          portal_visible: false,
          documents_enabled: false
        )
      end

      before do
        existing_client.dependents.create!(name: "Existing Kid", relationship: "Child")
        existing_return.income_sources.create!(source_type: "w2", payer_name: "Existing Employer")
      end

      def submit_matching_intake
        submit_intake(
          phone: "671-555-0000",
          spouse_name: nil,
          bank_routing_number: "111000025",
          bank_account_number: "555555555",
          bank_account_type: "savings",
          dependents: [ { name: "Submitted Kid", relationship: "Child" } ],
          income_sources: [ { source_type: "1099", payer_name: "Submitted Payer" } ]
        )
      end

      it "leaves the existing client, dependents, and return untouched" do
        expect { submit_matching_intake }.not_to(change { existing_client.reload.attributes })

        expect(response).to have_http_status(:created)
        expect(existing_client.bank_routing_number_encrypted).to eq("123456789")
        expect(existing_client.bank_account_number_encrypted).to eq("987654321")
        expect(existing_client.dependents.reload.pluck(:name)).to eq([ "Existing Kid" ])
        expect(existing_return.reload.income_sources.pluck(:payer_name)).to eq([ "Existing Employer" ])
        expect(existing_return.attributes).to include("source" => "admin_created", "portal_visible" => false, "documents_enabled" => false)
        expect(existing_client.tax_returns.count).to eq(1)
      end

      it "never hands out access to the existing client's records" do
        submit_matching_intake
        payload = JSON.parse(response.body)
        token_return = TaxReturn.find_signed!(payload.dig("document_upload", "upload_token"), purpose: :intake_document_upload)

        expect(payload.dig("client", "id")).not_to eq(existing_client.id)
        expect(payload.dig("tax_return", "id")).not_to eq(existing_return.id)
        expect(token_return).not_to eq(existing_return)
        expect(token_return.client).not_to eq(existing_client)
      end

      it "stores the submission on a separate client flagged for staff review" do
        expect { submit_matching_intake }.to change(Client, :count).by(1).and change(TaxReturn, :count).by(1)

        payload = JSON.parse(response.body)
        submitted_client = Client.find(payload.dig("client", "id"))
        submission = submitted_client.intake_submissions.sole

        expect(submission.status).to eq("needs_review")
        expect(submission.matched_client).to eq(existing_client)
        expect(submitted_client.phone).to eq("671-555-0000")
        expect(submitted_client.bank_routing_number_encrypted).to eq("111000025")
        expect(submitted_client.dependents.pluck(:name)).to eq([ "Submitted Kid" ])
        expect(submission.tax_return.income_sources.pluck(:payer_name)).to eq([ "Submitted Payer" ])
      end

      it "responds with the same shape a new client gets" do
        submit_matching_intake
        matched_keys = JSON.parse(response.body).keys

        submit_intake(email: "someone-else@example.com")

        expect(JSON.parse(response.body).keys).to eq(matched_keys)
      end

      it "points a repeat submission at the original client, not the earlier pending copy" do
        submit_matching_intake
        submit_matching_intake

        expect(IntakeSubmission.needs_review.pluck(:matched_client_id)).to eq([ existing_client.id, existing_client.id ])
      end
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
