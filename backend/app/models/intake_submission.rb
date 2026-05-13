# frozen_string_literal: true

class IntakeSubmission < ApplicationRecord
  SOURCES = %w[public_intake admin_entry portal].freeze
  STATUSES = %w[received reviewed linked archived].freeze

  belongs_to :client
  belongs_to :tax_return

  validates :payload, presence: true
  validates :source, inclusion: { in: SOURCES }
  validates :status, inclusion: { in: STATUSES }
  validates :submitted_at, presence: true
end
