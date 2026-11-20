# frozen_string_literal: true

require "csv"

module Reports
  class HoursReportCsv
    FORMULA_PREFIX = /\A[ \t\r\n]*[=+\-@]/

    # One row per work line. Work columns follow the order staff log time in:
    # Client -> Category -> Task -> Period -> Comments. Entry columns (times,
    # breaks, approval) repeat on each line of a split entry; "Line" shows
    # e.g. "2 of 3" so split entries are easy to spot.
    DETAILED_HEADERS = [
      "Export Reference", "Employee", "Date", "Start", "End", "Break Minutes",
      "Client", "Category", "Task", "Period", "Tax Year", "Entry Method", "Regular Hours", "Overtime Hours",
      "Total Hours", "Approval Status", "Approved By", "Approved At", "Finalized", "Comments", "Entry ID", "Line"
    ].freeze

    SUMMARY_HEADERS = [
      "Export Reference", "Employee", "Role", "Regular Hours", "Overtime Hours", "Total Hours",
      "Break Hours", "Entries", "Report Status", "Finalization Coverage"
    ].freeze

    def self.detailed(report:, export:)
      CSV.generate(headers: true) do |csv|
        csv << DETAILED_HEADERS
        Array(report[:employees]).each do |employee|
          Array(employee[:days]).each do |day|
            Array(day[:entries]).each do |entry|
              lines = Array(entry[:work_lines]).presence || [ entry ]
              lines.each_with_index do |line, index|
                csv << sanitize_row([
                  export.public_id,
                  employee[:full_name],
                  entry[:work_date],
                  entry[:formatted_start_time],
                  entry[:formatted_end_time],
                  entry[:break_minutes],
                  line[:client_label] || line.dig(:client, :name) || "Unassigned",
                  line[:category_label] || "Uncategorized",
                  line.dig(:service_task, :name),
                  line[:period_label],
                  entry.dig(:tax_return, :tax_year),
                  entry[:entry_method],
                  format_hours(line[:regular_hours]),
                  format_hours(line[:overtime_hours]),
                  format_hours(line[:total_hours]),
                  entry[:approval_status] || "standard",
                  entry.dig(:approved_by, :full_name),
                  entry[:approved_at],
                  entry[:locked_at].present? ? "Yes" : "No",
                  line[:description],
                  entry[:id],
                  "#{index + 1} of #{lines.size}"
                ])
              end
            end
          end
        end
      end
    end

    def self.summary(report:, export:)
      finalization = report.dig(:finalization, :label) || "Not finalized"
      CSV.generate(headers: true) do |csv|
        csv << SUMMARY_HEADERS
        Array(report[:employees]).each do |employee|
          csv << sanitize_row([
            export.public_id,
            employee[:full_name],
            employee[:role].to_s.capitalize,
            format_hours(employee[:regular_hours]),
            format_hours(employee[:overtime_hours]),
            format_hours(employee[:total_hours]),
            format_hours(employee[:break_hours]),
            employee[:entries_count],
            report_status(employee),
            finalization
          ])
        end
      end
    end

    def self.report_status(employee)
      issues = employee[:issues] || {}
      blocking = issues[:pending_count].to_i + issues[:pending_overtime_count].to_i + issues[:open_clock_count].to_i
      excluded = issues[:denied_count].to_i + issues[:denied_overtime_count].to_i
      return "Draft - needs review" if blocking.positive?
      return "Complete with exclusions" if excluded.positive?

      "Complete"
    end

    def self.format_hours(value)
      format("%.2f", value.to_f)
    end

    def self.sanitize_row(values)
      values.map do |value|
        value.is_a?(String) && value.match?(FORMULA_PREFIX) ? "'#{value}" : value
      end
    end
    private_class_method :format_hours, :sanitize_row, :report_status
  end
end
