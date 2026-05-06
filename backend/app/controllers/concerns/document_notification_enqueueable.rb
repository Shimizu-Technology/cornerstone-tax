# frozen_string_literal: true

module DocumentNotificationEnqueueable
  extend ActiveSupport::Concern

  private

  def enqueue_document_upload_notification(document, tax_return)
    DocumentUploadNotificationJob.perform_later(document.id, tax_return.id)
  rescue StandardError => e
    Rails.logger.error(
      "Failed to enqueue document upload notification for document #{document.id}, " \
      "tax return #{tax_return.id}: #{e.class} - #{e.message}"
    )
  end
end
