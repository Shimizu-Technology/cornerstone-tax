# frozen_string_literal: true

require "csv"

module Reports
  # CSV of a person's work summary: one row per work line (in the owner's
  # order: client, category, task, period, comments), then a blank row
  # and the totals per client (minutes and hours), like the old spreadsheets.
  module WorkSummaryCsv
    FORMULA_PREFIX = /\A[ \t\r\n]*[=+\-@]/
    LINE_HEADERS = [ "Date", "Time", "Client", "Category", "Task", "Period", "Comments", "Minutes", "Hours", "Status" ].freeze

    module_function

    def call(summary)
      CSV.generate do |csv|
        csv << [ "Work summary", summary.dig(:user, :full_name), "#{summary[:start_date]} to #{summary[:end_date]}" ]
        csv << []
        csv << LINE_HEADERS
        summary[:days].each do |day|
          day[:lines].each do |line|
            csv << sanitize([
              line[:work_date], line[:time_range], line[:client_name], line[:category], line[:task],
              line[:period], line[:description], line[:minutes], format("%.2f", line[:hours]), line[:approval_state]
            ])
          end
        end
        csv << []
        csv << [ "Totals by client", nil, nil, nil, nil, nil, nil, "Minutes", "Hours", "Hours and minutes" ]
        summary[:clients].each do |client|
          csv << sanitize([ client[:client_name], nil, nil, nil, nil, nil, nil, client[:minutes], format("%.2f", client[:hours]), client[:label] ])
        end
        csv << [ "Total", nil, nil, nil, nil, nil, nil, summary[:total_minutes], format("%.2f", summary[:total_hours]), summary[:total_label] ]
      end
    end

    def sanitize(values)
      values.map { |value| value.is_a?(String) && value.match?(FORMULA_PREFIX) ? "'#{value}" : value }
    end
  end
end
