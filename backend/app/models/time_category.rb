# frozen_string_literal: true

class TimeCategory < ApplicationRecord
  # Legacy categories are deactivated, never deleted, once time uses them.
  has_many :time_entries, dependent: :restrict_with_error

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
end
