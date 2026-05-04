# frozen_string_literal: true

module Api
  module V1
    class IntakeDocumentsController < BaseController
      include DocumentValidatable

      before_action :set_tax_return_from_upload_token

      # POST /api/v1/intake_documents/presign
      def presign
        unless S3Service.configured?
          return render json: { error: "File uploads are not available at this time" }, status: :service_unavailable
        end

        filename = params[:filename]
        content_type = params[:content_type]
        file_size = params[:file_size].to_i

        if filename.blank?
          return render json: { error: "Filename is required" }, status: :unprocessable_entity
        end

        if content_type.blank?
          return render json: { error: "Content type is required" }, status: :unprocessable_entity
        end

        if file_size <= 0
          return render json: { error: "File size is required and must be positive" }, status: :unprocessable_entity
        end

        if file_size > MAX_FILE_SIZE
          return render json: { error: "File size exceeds maximum allowed size of 50MB" }, status: :unprocessable_entity
        end

        unless ALLOWED_CONTENT_TYPES.include?(content_type)
          return render json: { error: "File type not allowed. Accepted types include PDF, images, Word, Excel, PowerPoint, CSV, and text files" }, status: :unprocessable_entity
        end

        unless content_type_matches_extension?(content_type, filename)
          return render json: { error: "File extension does not match the declared content type" }, status: :unprocessable_entity
        end

        begin
          result = S3Service.presign_upload(
            filename: filename,
            content_type: content_type,
            tax_return_id: @tax_return.id
          )
        rescue StandardError => e
          Rails.logger.error "Intake S3 presign failed for tax return #{@tax_return.id}: #{e.message}"
          return render json: { error: "File upload service is temporarily unavailable. Please try again." }, status: :service_unavailable
        end

        render json: {
          upload_url: result[:url],
          s3_key: result[:s3_key],
          expires_in: 3600
        }
      end

      # POST /api/v1/intake_documents
      def create
        s3_key = document_params[:s3_key]
        expected_prefix = "tax_returns/#{@tax_return.id}/"
        unless s3_key.present? && s3_key.start_with?(expected_prefix)
          return render json: { error: "Invalid S3 key" }, status: :unprocessable_entity
        end

        content_type = document_params[:content_type]
        filename = document_params[:filename]
        file_size = document_params[:file_size].to_i

        unless content_type.present? && ALLOWED_CONTENT_TYPES.include?(content_type)
          return render json: { error: "Invalid content type" }, status: :unprocessable_entity
        end

        unless content_type_matches_extension?(content_type, filename.to_s)
          return render json: { error: "Content type does not match file extension" }, status: :unprocessable_entity
        end

        if file_size <= 0 || file_size > MAX_FILE_SIZE
          return render json: { error: "File size must be between 1 byte and 50MB" }, status: :unprocessable_entity
        end

        unless uploaded_object_available?(s3_key, file_size)
          return render json: { error: "Uploaded file could not be verified. Please upload it again." }, status: :unprocessable_entity
        end

        doc_type = document_params[:document_type].presence || "other"
        unless Document::DOCUMENT_TYPES.include?(doc_type)
          return render json: { error: "Invalid document type. Allowed: #{Document::DOCUMENT_TYPES.join(', ')}" }, status: :unprocessable_entity
        end

        document = @tax_return.documents.build(document_params.merge(document_type: doc_type))

        if document.save
          DocumentUploadNotificationJob.perform_later(document.id, @tax_return.id)
          render json: { document: document_json(document) }, status: :created
        else
          render json: { errors: document.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def set_tax_return_from_upload_token
        @tax_return = TaxReturn.find_signed(
          params[:upload_token],
          purpose: :intake_document_upload
        )
        render json: { error: "Invalid or expired upload token" }, status: :not_found unless @tax_return
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
          created_at: doc.created_at,
          tax_return_id: doc.tax_return_id
        }
      end
    end
  end
end
