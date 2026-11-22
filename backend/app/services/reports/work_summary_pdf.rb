# frozen_string_literal: true

require "prawn"
require "prawn/table"

module Reports
  # Printable work summary for one person and pay period.
  class WorkSummaryPdf
    INK = "3D3D3D"
    PRIMARY_DARK = "6A584E"
    SOFT_ROW = "F8F4F1"
    BORDER = "E5DDD6"
    MUTED = "5E6F70"

    def initialize(summary)
      @summary = summary
    end

    def render
      Prawn::Document.new(page_size: "LETTER", margin: [ 42, 36, 48, 36 ], info: { Title: "Work summary - #{summary.dig(:user, :full_name)}" }) do |pdf|
        PdfTypography.apply(pdf)
        header(pdf)
        days(pdf)
        client_totals(pdf)
        pdf.number_pages "Page <page> of <total>", at: [ pdf.bounds.right - 120, -14 ], width: 120, align: :right, size: 7.5
      end.render
    end

    private

    attr_reader :summary

    def header(pdf)
      pdf.fill_color PRIMARY_DARK
      pdf.text "Work summary", size: 18, style: :bold
      pdf.fill_color INK
      pdf.text summary.dig(:user, :full_name).to_s, size: 12, style: :bold
      pdf.fill_color MUTED
      pdf.text "#{format_date(summary[:start_date])} – #{format_date(summary[:end_date])} · Total #{summary[:total_label]} (#{hours(summary[:total_hours])})", size: 9
      counts = summary[:counts]
      notes = []
      notes << "#{counts[:pending_entries]} pending approval" if counts[:pending_entries].positive?
      notes << "#{counts[:denied_entries]} denied (not included)" if counts[:denied_entries].positive?
      notes << "#{WorkLineHours.format_minutes(counts[:unassigned_minutes])} without a client" if counts[:unassigned_minutes].positive?
      pdf.text notes.join(" · "), size: 8.5 if notes.any?
      pdf.fill_color INK
      pdf.move_down 12
    end

    def days(pdf)
      rows = [ [ "Date", "Client", "Category / Task", "Period", "Comments", "Time" ] ]
      summary[:days].each do |day|
        day[:lines].each_with_index do |line, index|
          rows << [
            index.zero? ? format_date(day[:work_date]) : "",
            line[:client_name],
            [ line[:category], line[:task] ].compact.join(" / "),
            line[:period].to_s,
            line[:description].to_s,
            "#{WorkLineHours.format_minutes(line[:minutes])}#{line[:approval_state] == 'pending' ? ' *' : ''}"
          ]
        end
        rows << [ "", "", "", "", { content: "Day total", font_style: :bold }, { content: day[:total_label], font_style: :bold } ]
      end
      rows << [ { content: "No work logged in this period.", colspan: 6 } ] if rows.one?
      table(pdf, rows, [ 62, 106, 120, 72, 130, 50 ])
      if summary[:days].any? { |day| day[:lines].any? { |line| line[:approval_state] == "pending" } }
        pdf.move_down 4
        pdf.text "* Pending approval", size: 7.5, color: MUTED
      end
      pdf.move_down 14
    end

    def client_totals(pdf)
      pdf.text "Totals by client", size: 12, style: :bold
      pdf.move_down 6
      rows = [ [ "Client", "Minutes", "Hours", "Hours and minutes" ] ]
      summary[:clients].each { |client| rows << [ client[:client_name], client[:minutes].to_s, hours(client[:hours]), client[:label] ] }
      rows << [ { content: "Total", font_style: :bold }, summary[:total_minutes].to_s, hours(summary[:total_hours]), summary[:total_label] ]
      table(pdf, rows, [ 240, 90, 90, 120 ], right_columns: 1..3)
    end

    def table(pdf, rows, widths, right_columns: nil)
      pdf.table(rows, header: true, width: widths.sum, column_widths: widths, cell_style: { size: 8, padding: [ 4, 4 ], border_color: BORDER }) do |t|
        t.row_colors = [ "FFFFFF", SOFT_ROW ] if rows.length > 2
        t.row(0).background_color = PRIMARY_DARK
        t.row(0).text_color = "FFFFFF"
        t.row(0).font_style = :bold
        t.columns(right_columns).align = :right if right_columns
      end
    end

    def format_date(iso)
      Date.iso8601(iso).strftime("%a %b %-d, %Y")
    end

    def hours(value)
      format("%.2fh", value.to_f)
    end
  end
end
