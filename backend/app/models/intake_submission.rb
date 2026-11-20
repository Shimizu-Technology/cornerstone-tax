# frozen_string_literal: true

class IntakeSubmission < ApplicationRecord
  SOURCES = %w[public_intake admin_entry portal].freeze
  # needs_review: the submitted email matched an existing client. The
  # submission lives on its own client record until staff merge it into the
  # matched client ("linked") or keep the two apart ("reviewed").
  STATUSES = %w[received needs_review reviewed linked archived].freeze

  belongs_to :client
  belongs_to :tax_return
  belongs_to :matched_client, class_name: "Client", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true

  validates :payload, presence: true
  validates :source, inclusion: { in: SOURCES }
  validates :status, inclusion: { in: STATUSES }
  validates :submitted_at, presence: true

  scope :needs_review, -> { where(status: "needs_review") }
end
