# frozen_string_literal: true

class TimeEntry < ApplicationRecord
  belongs_to :user
  belongs_to :client, optional: true
  belongs_to :tax_return, optional: true
  belongs_to :time_category, optional: true

  validates :work_date, presence: true
  validates :hours, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 24 }

  scope :for_date, ->(date) { where(work_date: date) }
  scope :for_week, ->(date) { where(work_date: date.beginning_of_week..date.end_of_week) }
  scope :for_user, ->(user) { where(user: user) }
  scope :recent, -> { order(work_date: :desc, created_at: :desc) }
end
