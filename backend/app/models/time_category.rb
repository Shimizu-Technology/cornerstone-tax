# frozen_string_literal: true

class TimeCategory < ApplicationRecord
  has_many :time_entries, dependent: :nullify

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
end
