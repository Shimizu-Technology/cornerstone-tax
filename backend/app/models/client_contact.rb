# frozen_string_literal: true

class ClientContact < ApplicationRecord
  belongs_to :client

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :is_primary, uniqueness: { scope: :client_id }, if: :is_primary?

  def full_name
    "#{first_name} #{last_name}".strip
  end
end
