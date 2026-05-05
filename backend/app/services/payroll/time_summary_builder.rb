# frozen_string_literal: true

module Payroll
  class TimeSummaryBuilder
    SOURCE = "cornerstone_tax"
    MAX_RANGE_DAYS = 62

    attr_reader :start_date, :end_date

    def initialize(start_date:, end_date:)
      @start_date = parse_date!(start_date, "start_date")
      @end_date = parse_date!(end_date, "end_date")
      raise ArgumentError, "end_date must be on or after start_date" if @end_date < @start_date
      raise ArgumentError, "date range may not exceed #{MAX_RANGE_DAYS} days" if (@end_date - @start_date).to_i > MAX_RANGE_DAYS
    end

    def call
      users = User.staff.where(id: entries_in_range.where.not(user_id: nil).select(:user_id)).order(:last_name, :first_name, :email).to_a

      {
        source: SOURCE,
        start_date: start_date.iso8601,
        end_date: end_date.iso8601,
        generated_at: Time.current.iso8601,
        employees: users.map { |user| serialize_user(user) },
        summary: summary
      }
    end

    private

    def parse_date!(value, name)
      raise ArgumentError, "#{name} is required" if value.blank?
      Date.iso8601(value.to_s)
    rescue Date::Error
      raise ArgumentError, "#{name} must be a valid ISO 8601 date (YYYY-MM-DD)"
    end

    def entries_in_range
      TimeEntry.where(work_date: start_date..end_date)
    end

    def serialize_user(user)
      user_entries = entries_in_range.where(user_id: user.id)
      countable = user_entries.countable.includes(:time_category)
      grouped_days = countable.group_by(&:work_date).sort_by { |date, _| date }

      days = grouped_days.map do |date, entries|
        categories = entries.group_by(&:time_category).map do |category, category_entries|
          {
            source_category_id: category&.id&.to_s,
            name: category&.name || "Uncategorized",
            hours: round_hours(category_entries.sum { |entry| entry.hours.to_f }),
            entry_ids: category_entries.map(&:id)
          }
        end

        {
          work_date: date.iso8601,
          hours: round_hours(entries.sum { |entry| entry.hours.to_f }),
          entry_ids: entries.map(&:id),
          categories: categories
        }
      end

      issues = issues_for(user_entries)

      {
        source_user_id: user.id.to_s,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.full_name,
        days: days,
        total_hours: round_hours(days.sum { |day| day[:hours].to_f }),
        entries_count: countable.size,
        issues: issues,
        ready: issues.values_at(:pending_count, :pending_overtime_count, :denied_count, :denied_overtime_count, :open_clock_count).all?(&:zero?)
      }
    end

    def issues_for(scope)
      pending = scope.where(approval_status: "pending")
      denied = scope.where(approval_status: "denied")
      pending_overtime = scope.where(overtime_status: "pending")
      denied_overtime = scope.where(overtime_status: "denied")
      open_clock = scope.where(status: %w[clocked_in on_break])

      {
        pending_count: pending.count,
        pending_hours: round_hours(pending.sum(:hours).to_f),
        pending_overtime_count: pending_overtime.count,
        pending_overtime_hours: round_hours(pending_overtime.sum(:hours).to_f),
        denied_count: denied.count,
        denied_hours: round_hours(denied.sum(:hours).to_f),
        denied_overtime_count: denied_overtime.count,
        denied_overtime_hours: round_hours(denied_overtime.sum(:hours).to_f),
        open_clock_count: open_clock.count,
        open_clock_entry_ids: open_clock.pluck(:id)
      }
    end

    def summary
      all_entries = entries_in_range
      {
        employee_count: all_entries.where.not(user_id: nil).distinct.count(:user_id),
        countable_hours: round_hours(all_entries.countable.sum(:hours).to_f),
        pending_count: all_entries.where(approval_status: "pending").count,
        denied_count: all_entries.where(approval_status: "denied").count,
        pending_overtime_count: all_entries.where(overtime_status: "pending").count,
        denied_overtime_count: all_entries.where(overtime_status: "denied").count,
        open_clock_count: all_entries.where(status: %w[clocked_in on_break]).count
      }
    end

    def round_hours(value)
      BigDecimal(value.to_s).round(2).to_f
    end
  end
end
