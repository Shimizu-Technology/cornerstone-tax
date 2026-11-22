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
      TimeEntry.consistent_read { build }
    end

    private

    # Entries and their work lines are read from one snapshot.
    def build
      entries = TimeEntry.where(user_id: user.id, work_date: start_date..end_date)
                         .includes(:time_category, work_lines: [ :client, :service_type, :service_task ])
                         .order(:work_date, :start_time, :created_at, :id)
                         .to_a
      included = entries.select { |entry| entry.status == "completed" && entry.approval_status != "denied" }
      rows = included.flat_map { |entry| line_rows(entry) }

      # Totals are minutes of the summed decimal hours, so "h:m" always
      # agrees with the hours column (six 0.02h lines: 0.12h = 7m, not 6m).
      days = rows.group_by { |row| row[:work_date] }.sort.map do |date, day_rows|
        day_hours = hours(day_rows)
        minutes = minutes_for(day_hours)
        { work_date: date, lines: day_rows, total_minutes: minutes, total_hours: day_hours, total_label: label(minutes) }
      end

      clients = rows.group_by { |row| [ row[:client_id], row[:client_name] ] }.map do |(client_id, name), client_rows|
        client_hours = hours(client_rows)
        minutes = minutes_for(client_hours)
        { client_id: client_id, client_name: name, system_kind: client_rows.first[:system_kind],
          minutes: minutes, hours: client_hours, label: label(minutes), lines_count: client_rows.size }
      end.sort_by { |row| [ -row[:minutes], row[:client_id] ? 0 : 1, row[:client_name].downcase ] }

      total_minutes = minutes_for(hours(rows))
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
          unassigned_minutes: minutes_for(hours(rows.select { |row| row[:client_id].nil? }))
        }
      }
    end


    def parse_date!(value, name)
      raise ArgumentError, "#{name} is required" if value.blank?

      Date.iso8601(value.to_s)
    rescue Date::Error
      raise ArgumentError, "#{name} must be a valid ISO 8601 date (YYYY-MM-DD)"
    end

    def line_rows(entry)
      lines = entry.work_lines.to_a
      lines = [ Payroll::HoursReportBuilder::VirtualLine.new(entry: entry) ] if lines.empty?
      line_minutes = cumulative_minutes(lines.map(&:hours))
      lines.each_with_index.map do |line, index|
        {
          entry_id: entry.id,
          work_date: entry.work_date.iso8601,
          time_range: time_range(entry),
          client_id: line.client_id,
          client_name: line.client_label,
          system_kind: line.client&.system_kind,
          category: line.category_label,
          task: line.service_task&.name,
          period: line.period_label,
          # The line's comments (optional).
          description: line.description,
          minutes: line_minutes[index],
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

    # Each line's minutes rounded cumulatively within its entry, so an
    # entry's line minutes add up to its hours in minutes.
    def cumulative_minutes(hours_list)
      cumulative = BigDecimal("0")
      previous = 0
      hours_list.map do |value|
        cumulative += BigDecimal(value.to_s)
        rounded = minutes_for(cumulative)
        minutes = rounded - previous
        previous = rounded
        minutes
      end
    end

    def minutes_for(decimal_hours)
      (BigDecimal(decimal_hours.to_s) * 60).round.to_i
    end

    def label(minutes)
      WorkLineHours.format_minutes(minutes)
    end
  end
end
