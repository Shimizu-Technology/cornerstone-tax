# frozen_string_literal: true

module Payroll
  # Work Hours v1: hours by person, date, client, category, task and period,
  # read from time entry work lines, for Cornerstone Payroll's cost and
  # profit per client. Payroll adds pay, employer taxes and client fees on
  # its side; this feed never carries pay, rates, SSNs or bank data.
  #
  # Read-only: unlike the time summary it does not capture a payroll export
  # or protect (lock) entries.
  #
  # Contract: docs/PAYROLL_WORK_HOURS_V1.md
  class WorkHoursBuilder
    SCHEMA_VERSION = "1.0"
    SOURCE = "cornerstone_tax"
    MAX_RANGE_DAYS = 62
    UNASSIGNED = TimeEntryAllocation::UNASSIGNED_LABEL

    attr_reader :start_date, :end_date

    def initialize(start_date:, end_date:)
      @start_date = parse_date!(start_date, "start")
      @end_date = parse_date!(end_date, "end")
      raise ArgumentError, "end must be on or after start" if @end_date < @start_date
      raise ArgumentError, "date range may not exceed #{MAX_RANGE_DAYS} days" if (@end_date - @start_date).to_i > MAX_RANGE_DAYS
    end

    def call
      staff_ids = User.staff.pluck(:id)
      entries = TimeEntry.where(work_date: start_date..end_date, user_id: staff_ids)
                         .includes(:user, :time_category, work_lines: [ :client, :service_type, :service_task ])
                         .order(:user_id, :work_date, :id)
                         .to_a
      reported = entries.select { |entry| entry.status == "completed" && entry.approval_status != "denied" }

      {
        schema_version: SCHEMA_VERSION,
        source: SOURCE,
        start_date: start_date.iso8601,
        end_date: end_date.iso8601,
        generated_at: Time.current.iso8601,
        rows: rows_for(reported),
        day_totals: day_totals(reported),
        counts: counts(entries)
      }
    end

    private

    def parse_date!(value, name)
      raise ArgumentError, "#{name} is required" if value.blank?

      Date.iso8601(value.to_s)
    rescue Date::Error
      raise ArgumentError, "#{name} must be a valid ISO 8601 date (YYYY-MM-DD)"
    end

    def approval_state(entry)
      return "pending" if entry.approval_status == "pending"
      return "approved" if entry.approval_status == "approved"

      "clock"
    end

    def lines_for(entry)
      lines = entry.work_lines.to_a
      lines.empty? ? [ HoursReportBuilder::VirtualLine.new(entry: entry) ] : lines
    end

    def rows_for(entries)
      groups = Hash.new { |hash, key| hash[key] = { hours: BigDecimal("0"), entry_ids: [] } }
      samples = {}

      entries.each do |entry|
        lines_for(entry).each do |line|
          key = [ entry.user_id, entry.work_date, line.client_id, line.service_type_id,
                  line.service_type_id ? nil : entry.time_category_id, line.service_task_id,
                  line.period_type, line.period_start, approval_state(entry) ]
          groups[key][:hours] += BigDecimal(line.hours.to_s)
          groups[key][:entry_ids] |= [ entry.id ]
          samples[key] ||= [ entry, line ]
        end
      end

      groups.map do |key, totals|
        entry, line = samples[key]
        {
          tax_user_id: entry.user_id,
          email: entry.user.email,
          work_date: entry.work_date.iso8601,
          client_id: line.client_id,
          client_name: line.client ? line.client.display_name : UNASSIGNED,
          system_kind: line.client&.system_kind,
          unassigned: line.client_id.nil?,
          category_id: line.service_type_id,
          category: line.category_label,
          task_id: line.service_task_id,
          task: line.service_task&.name,
          period_type: line.period_type,
          period_start: line.period_start&.iso8601,
          period_label: line.period_label,
          hours: totals[:hours].round(2).to_f,
          minutes: (totals[:hours] * 60).round.to_i,
          entry_ids: totals[:entry_ids].sort,
          approval_state: key.last
        }
      end.sort_by { |row| [ row[:tax_user_id], row[:work_date], row[:unassigned] ? 1 : 0, row[:client_name].downcase, row[:category].to_s, row[:task].to_s, row[:approval_state] ] }
    end

    # countable_hours matches GET /api/v1/payroll/time_summary day hours
    # (approved and clock entries); pending hours are listed separately.
    def day_totals(entries)
      entries.group_by { |entry| [ entry.user_id, entry.work_date ] }.sort.map do |(user_id, date), day_entries|
        countable = day_entries.reject { |entry| entry.approval_status == "pending" }
        pending = day_entries.select { |entry| entry.approval_status == "pending" }
        {
          tax_user_id: user_id,
          email: day_entries.first.user.email,
          work_date: date.iso8601,
          countable_hours: sum_hours(countable),
          pending_hours: sum_hours(pending),
          unassigned_hours: day_entries.sum { |entry| lines_for(entry).select { |line| line.client_id.nil? }.sum { |line| BigDecimal(line.hours.to_s) } }.round(2).to_f
        }
      end
    end

    def counts(entries)
      by_user = entries.group_by(&:user_id).sort.map do |user_id, user_entries|
        { tax_user_id: user_id, email: user_entries.first.user.email }.merge(count_states(user_entries))
      end
      count_states(entries).merge(by_user: by_user)
    end

    def count_states(entries)
      {
        pending_entries: entries.count { |entry| entry.status == "completed" && entry.approval_status == "pending" },
        denied_entries: entries.count { |entry| entry.approval_status == "denied" },
        open_clock_entries: entries.count(&:active?)
      }
    end

    def sum_hours(entries)
      entries.sum { |entry| BigDecimal(entry.hours.to_s) }.round(2).to_f
    end
  end
end
