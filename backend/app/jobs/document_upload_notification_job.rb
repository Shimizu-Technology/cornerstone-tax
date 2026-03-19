# frozen_string_literal: true

class DocumentUploadNotificationJob < ApplicationJob
  queue_as :default

  def perform(document_id, tax_return_id)
    document = Document.find_by(id: document_id)
    return unless document

    tax_return = TaxReturn.find_by(id: tax_return_id)
    return unless tax_return

    already_sent = Notification.where(
      tax_return_id: tax_return_id,
      template: "document_uploaded_by_client",
      status: "sent"
    ).where("content LIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(document.filename)}%")
     .where("created_at > ?", 5.minutes.ago)
     .exists?

    return if already_sent

    NotificationService.notify_document_uploaded(
      document: document,
      tax_return: tax_return,
      uploaded_by_client: true
    )
  end
end
