# frozen_string_literal: true

class TimePeriodLock < ApplicationRecord
  belongs_to :locked_by, class_name: "User"

  validates :start_date, :end_date, :locked_at, presence: true
  validate :end_date_on_or_after_start_date

  # Locking a period and bulk-approving entries (time_entries#approve_unscheduled_only)
  # both take this transaction-scoped advisory lock first. So a period
  # locked while a bulk approval runs either waits for it to commit, or
  # commits first and is seen by it; an entry in a locked period is never
  # approved by it.
  APPROVAL_ADVISORY_KEY = 0x54504c4b # "TPLK"

  scope :covering_date, ->(date) { where("start_date <= ? AND end_date >= ?", date, date) }
  scope :recent, -> { order(start_date: :desc) }

  def self.week_bounds_for(date)
    d = date.to_date
    week_start = d.beginning_of_week(:sunday)
    week_end = week_start + 6.days
    [week_start, week_end]
  end

  def self.locked_for_date?(date)
    covering_date(date.to_date).exists?
  end

  def self.serialize_with_approvals!
    raise ActiveRecord::TransactionIsolationError, "serialize_with_approvals! must run inside a transaction" unless connection.transaction_open?

    connection.execute("SELECT pg_advisory_xact_lock(#{APPROVAL_ADVISORY_KEY})")
  end

  private

  def end_date_on_or_after_start_date
    return if end_date.blank? || start_date.blank?
    return if end_date >= start_date

    errors.add(:end_date, "must be on or after start date")
  end
end
