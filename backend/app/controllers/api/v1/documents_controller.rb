# frozen_string_literal: true

module Api
  module V1
    class DocumentsController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!
      before_action :set_tax_return
      before_action :set_document, only: [:show, :download, :destroy]

      # GET /api/v1/tax_returns/:tax_return_id/documents
      def index
        documents = @tax_return.documents.order(created_at: :desc)

        render json: documents.map { |doc| document_json(doc) }
      end

      # GET /api/v1/tax_returns/:tax_return_id/documents/:id
      def show
        render json: document_json(@document)
      end

      # POST /api/v1/tax_returns/:tax_return_id/documents/presign
      # Get a presigned URL for uploading
      def presign
        unless S3Service.configured?
          return render json: { error: "S3 not configured" }, status: :service_unavailable
        end

        filename = params[:filename]
        content_type = params[:content_type] || "application/octet-stream"
        file_size = params[:file_size].to_i

        if filename.blank?
          return render json: { error: "Filename is required" }, status: :unprocessable_entity
        end

        # CST-16: Validate file size is positive
        if file_size <= 0
          return render json: { error: "File size is required and must be positive" }, status: :unprocessable_entity
        end

        # CST-16: Validate file size (max 50MB)
        max_size = 50.megabytes
        if file_size > max_size
          return render json: {
            error: "File size exceeds maximum allowed size of 50MB"
          }, status: :unprocessable_entity
        end

        # CST-16: Validate content type (PDF, JPEG, PNG only)
        allowed_types = %w[application/pdf image/jpeg image/png]
        unless allowed_types.include?(content_type)
          return render json: {
            error: "File type not allowed. Accepted types: PDF, JPEG, PNG",
            allowed_types: allowed_types
          }, status: :unprocessable_entity
        end

        result = S3Service.presign_upload(
          filename: filename,
          content_type: content_type,
          tax_return_id: @tax_return.id
        )

        render json: {
          upload_url: result[:url],
          s3_key: result[:s3_key],
          expires_in: 3600
        }
      end

      # POST /api/v1/tax_returns/:tax_return_id/documents
      # Register a document after successful upload
      def create
        document = @tax_return.documents.build(document_params)
        document.uploaded_by = current_user

        if document.save
          render json: document_json(document), status: :created
        else
          render json: { errors: document.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/tax_returns/:tax_return_id/documents/:id/download
      # Get a presigned URL for downloading
      def download
        unless S3Service.configured?
          return render json: { error: "S3 not configured" }, status: :service_unavailable
        end

        download_url = S3Service.presign_download(
          s3_key: @document.s3_key,
          filename: @document.filename,
          expires_in: 3600
        )

        render json: { download_url: download_url, expires_in: 3600 }
      end

      # DELETE /api/v1/tax_returns/:tax_return_id/documents/:id
      def destroy
        s3_key = @document.s3_key

        ActiveRecord::Base.transaction do
          # Log the deletion
          @document.tax_return.workflow_events.create!(
            user: current_user,
            event_type: "document_deleted",
            old_value: @document.filename,
            description: "Document deleted: #{@document.filename}"
          )

          @document.destroy!
        end

        # Delete from S3 after successful DB commit to avoid orphaned records
        if S3Service.configured?
          S3Service.delete_object(s3_key: s3_key)
        end

        render json: { message: "Document deleted" }
      end

      private

      # CST-14: Always scope through tax_return to prevent unauthorized access
      def set_tax_return
        @tax_return = TaxReturn.find(params[:tax_return_id])
      end

      # CST-14: Scope document lookup through tax_return
      def set_document
        @document = @tax_return.documents.find(params[:id])
      end

      def document_params
        params.require(:document).permit(:filename, :s3_key, :content_type, :file_size, :document_type)
      end

      def document_json(doc)
        {
          id: doc.id,
          filename: doc.filename,
          document_type: doc.document_type,
          content_type: doc.content_type,
          file_size: doc.file_size,
          uploaded_by: doc.uploaded_by ? {
            id: doc.uploaded_by.id,
            email: doc.uploaded_by.email
          } : nil,
          created_at: doc.created_at,
          tax_return_id: doc.tax_return_id
        }
      end
    end
  end
end
