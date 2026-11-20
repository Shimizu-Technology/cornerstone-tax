# frozen_string_literal: true

module Reports
  # One person's work for a pay period, the way staff used to email it:
  # each day's work lines (client, what was done, minutes), then totals per
  # client in hours and minutes. Replaces the emailed "summary of hours"
  # spreadsheets.
  #
  # Includes completed entries that are approved, standard (clock) or pending
  # (marked as pending); denied entries are left out and counted separately.
  class WorkSummaryBuilder
    MAX_RANGE_DAYS = 62
    BUSINESS_TIMEZONE = TimeClockService::BUSINESS_TIMEZONE

    attr_reader :user, :start_date, :end_date

    def initialize(user:, start_date:, end_date:)
      @user = user
      @start_date = parse_date!(start_date, "start_date")
      @end_date = parse_date!(end_date, "end_date")
      raise ArgumentError, "end_date must be on or after start_date" if @end_date < @start_date
      raise ArgumentError, "date range may not exceed #{MAX_RANGE_DAYS} days" if (@end_date - @start_date).to_i > MAX_RANGE_DAYS
    end

    def call
      entries = TimeEntry.where(user_id: user.id, work_date: start_date..end_date)
                         .includes(:time_category, work_lines: [ :client, :service_type, :service_task ])
                         .order(:work_date, :start_time, :created_at, :id)
                         .to_a
      included = entries.select { |entry| entry.status == "completed" && entry.approval_status != "denied" }
      rows = included.flat_map { |entry| line_rows(entry) }

      days = rows.group_by { |row| row[:work_date] }.sort.map do |date, day_rows|
        minutes = day_rows.sum { |row| row[:minutes] }
        { work_date: date, lines: day_rows, total_minutes: minutes, total_hours: hours(day_rows), total_label: label(minutes) }
      end

      clients = rows.group_by { |row| [ row[:client_id], row[:client_name] ] }.map do |(client_id, name), client_rows|
        minutes = client_rows.sum { |row| row[:minutes] }
        { client_id: client_id, client_name: name, system_kind: client_rows.first[:system_kind],
          minutes: minutes, hours: hours(client_rows), label: label(minutes), lines_count: client_rows.size }
      end.sort_by { |row| [ -row[:minutes], row[:client_id] ? 0 : 1, row[:client_name].downcase ] }

      total_minutes = rows.sum { |row| row[:minutes] }
      {
        user: { id: user.id, full_name: user.full_name, email: user.email },
        start_date: start_date.iso8601,
        end_date: end_date.iso8601,
        generated_at: Time.current.iso8601,
        days: days,
        clients: clients,
        total_minutes: total_minutes,
        total_hours: hours(rows),
        total_label: label(total_minutes),
        counts: {
          entries: included.size,
          lines: rows.size,
          pending_entries: included.count { |entry| entry.approval_status == "pending" },
          denied_entries: entries.count { |entry| entry.approval_status == "denied" },
          open_clock_entries: entries.count(&:active?),
          unassigned_minutes: rows.select { |row| row[:client_id].nil? }.sum { |row| row[:minutes] }
        }
      }
    end

    private

    def parse_date!(value, name)
      raise ArgumentError, "#{name} is required" if value.blank?

      Date.iso8601(value.to_s)
    rescue Date::Error
      raise ArgumentError, "#{name} must be a valid ISO 8601 date (YYYY-MM-DD)"
    end

    def line_rows(entry)
      lines = entry.work_lines.to_a
      lines = [ Payroll::HoursReportBuilder::VirtualLine.new(entry: entry) ] if lines.empty?
      lines.map do |line|
        {
          entry_id: entry.id,
          work_date: entry.work_date.iso8601,
          time_range: time_range(entry),
          client_id: line.client_id,
          client_name: line.client_label,
          system_kind: line.client&.system_kind,
          description: line.description,
          category: line.category_label,
          task: line.service_task&.name,
          period: line.period_label,
          minutes: line.minutes,
          hours: line.hours.to_f,
          approval_state: approval_state(entry)
        }
      end
    end

    def time_range(entry)
      return nil if entry.duration_only? || entry.start_time.blank?

      [ entry.formatted_start_time, entry.formatted_end_time ].compact.join("–")
    end

    def approval_state(entry)
      return "pending" if entry.approval_status == "pending"
      return "approved" if entry.approval_status == "approved"

      "clock"
    end

    def hours(rows)
      rows.sum { |row| BigDecimal(row[:hours].to_s) }.round(2).to_f
    end

    def label(minutes)
      WorkLineHours.format_minutes(minutes)
    end
  end
end
