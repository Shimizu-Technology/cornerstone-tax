# frozen_string_literal: true

require "prawn"
require "prawn/table"

module Reports
  class EmployeeTimesheetPdf
    BUSINESS_TIMEZONE = TimeClockService::BUSINESS_TIMEZONE
    INK = "3D3D3D"
    PRIMARY = "78645A"
    PRIMARY_DARK = "6A584E"
    ACCENT = "B9A399"
    SOFT = "F5F0EC"
    GREEN = "047857"
    LIGHT_GREEN = "ECFDF5"
    AMBER = "92400E"
    LIGHT_AMBER = "FFFBEB"
    BORDER = "E5DDD6"
    MUTED = "5E6F70"

    def initialize(report:, export:, generated_by:)
      @report = report
      @export = export
      @employee = Array(report[:employees]).first
      @generated_by = generated_by
    end

    def render
      Prawn::Document.new(page_size: "LETTER", margin: [ 42, 36, 48, 36 ], info: metadata) do |pdf|
        PdfTypography.apply(pdf)
        render_header(pdf)
        render_identity(pdf)
        render_status(pdf)
        render_entries(pdf)
        render_weekly_totals(pdf)
        render_grand_totals(pdf)
        render_notes(pdf)
        render_footer(pdf)
      end.render
    end

    private

    attr_reader :report, :export, :employee, :generated_by

    def metadata
      {
        Title: "Cornerstone Employee Timesheet - #{employee[:full_name]}",
        Author: branding["business_name"],
        Subject: "Employee time entries from #{report[:start_date]} to #{report[:end_date]}",
        Creator: "Cornerstone Operations"
      }
    end

    def render_header(pdf)
      top = pdf.cursor
      pdf.fill_color PRIMARY_DARK
      pdf.text_box "CORNERSTONE", at: [ 0, top ], width: 230, height: 28, size: 20, style: :bold, character_spacing: 0.6
      pdf.fill_color INK
      pdf.text_box "EMPLOYEE TIMESHEET", at: [ 260, top - 2 ], width: 280, height: 22, align: :right, size: 14, style: :bold
      pdf.move_down 31
      pdf.stroke_color ACCENT
      pdf.line_width 2
      pdf.stroke_horizontal_rule
      pdf.move_down 5
      pdf.fill_color MUTED
      pdf.text contact_line, size: 6.8, align: :right
      pdf.move_down 10
    end

    def render_identity(pdf)
      details = [
        [ label("Employee"), value(employee[:full_name]), label("Period"), value("#{format_date(report[:start_date])} to #{format_date(report[:end_date])}") ],
        [ label("Generated"), value(generated_time), label("Reference"), value(export.public_id) ]
      ]
      pdf.table(details, width: pdf.bounds.width, column_widths: [ 76, 194, 76, 194 ], cell_style: { borders: [], padding: [ 2, 0, 5, 0 ], size: 8.5 })
      pdf.move_down 8
    end

    def render_status(pdf)
      complete = export.readiness_status == "complete"
      fill = complete ? LIGHT_GREEN : LIGHT_AMBER
      color = complete ? GREEN : AMBER

      pdf.fill_color fill
      pdf.fill_rounded_rectangle [ 0, pdf.cursor ], pdf.bounds.width, 54, 6
      pdf.fill_color color
      pdf.text_box readiness_title, at: [ 12, pdf.cursor - 10 ], width: 300, height: 15, size: 9.5, style: :bold
      pdf.fill_color MUTED
      pdf.text_box readiness_detail, at: [ 12, pdf.cursor - 24 ], width: 300, height: 24, size: 7.2, leading: 1
      pdf.fill_color PRIMARY_DARK
      pdf.text_box "Finalization", at: [ 342, pdf.cursor - 10 ], width: 176, height: 14, size: 7.2, style: :bold, align: :right
      pdf.fill_color MUTED
      pdf.text_box finalization_label, at: [ 342, pdf.cursor - 23 ], width: 176, height: 25, size: 7.2, align: :right
      pdf.move_down 64
    end

    def render_entries(pdf)
      pdf.fill_color INK
      pdf.text "Time Entries", size: 11.5, style: :bold
      pdf.move_down 6

      rows = [ [ "Date", "Start", "End", "Break", "Category / Service", "Regular", "OT", "Total" ] ]
      Array(employee[:days]).each do |day|
        Array(day[:entries]).each do |entry|
          rows << [
            format_date(entry[:work_date]),
            entry[:formatted_start_time] || "Open",
            entry[:formatted_end_time] || "Open",
            entry[:break_minutes].to_i.zero? ? "-" : "#{entry[:break_minutes]}m",
            work_label(entry),
            hours(entry[:regular_hours]),
            hours(entry[:overtime_hours]),
            hours(entry[:total_hours])
          ]
        end
      end
      rows << [ { content: "No included entries for this period.", colspan: 8 } ] if rows.one?

      pdf.table(rows, header: true, width: pdf.bounds.width, column_widths: [ 62, 51, 51, 42, 202, 46, 40, 46 ], cell_style: { size: 7.2, padding: [ 5, 4 ], border_color: BORDER }) do |table|
        table.row_colors = [ "FFFFFF", "FAF8F6" ] if rows.length > 2
        table.row(0).background_color = PRIMARY_DARK
        table.row(0).text_color = "FFFFFF"
        table.row(0).font_style = :bold
        table.columns(5..7).align = :right
      end
      pdf.move_down 15
    end

    def render_weekly_totals(pdf)
      weeks = Array(employee[:weeks])
      return if weeks.empty?

      ensure_totals_space(pdf, weeks.length)
      pdf.fill_color INK
      pdf.text "Weekly Totals", size: 10.5, style: :bold
      pdf.move_down 5
      rows = [ [ "Week", "Hours in Period", "Regular", "Overtime", "Full Week Total" ] ]
      weeks.each do |week|
        rows << [
          "#{format_date(week[:week_start])} to #{format_date(week[:week_end])}",
          hours(week[:period_hours]),
          hours(week[:regular_hours]),
          hours(week[:overtime_hours]),
          hours(week[:weekly_total_hours])
        ]
      end
      pdf.table(rows, header: true, width: pdf.bounds.width, cell_style: { size: 7.5, padding: [ 5, 5 ], border_color: BORDER }) do |table|
        table.row(0).background_color = SOFT
        table.row(0).text_color = PRIMARY_DARK
        table.row(0).font_style = :bold
        table.columns(1..4).align = :right
      end
      pdf.move_down 13
    end

    def ensure_totals_space(pdf, week_count)
      required_height = 130 + (week_count * 22)
      return if pdf.cursor >= required_height

      pdf.start_new_page
      pdf.fill_color PRIMARY_DARK
      pdf.text "#{employee[:full_name]} - totals continued", size: 10.5, style: :bold
      pdf.move_down 10
    end

    def render_grand_totals(pdf)
      rows = [
        [ "Regular Hours", "Overtime Hours", "Total Hours", "Break Hours", "Entries" ],
        [ hours(employee[:regular_hours]), hours(employee[:overtime_hours]), hours(employee[:total_hours]), hours(employee[:break_hours]), employee[:entries_count].to_i.to_s ]
      ]
      pdf.table(rows, width: pdf.bounds.width, cell_style: { align: :center, padding: [ 8, 5 ], border_color: BORDER }) do |table|
        table.row(0).background_color = PRIMARY_DARK
        table.row(0).text_color = "FFFFFF"
        table.row(0).font_style = :bold
        table.row(0).size = 7.5
        table.row(1).text_color = PRIMARY
        table.row(1).font_style = :bold
        table.row(1).size = 12.5
      end
      pdf.move_down 12
    end

    def render_notes(pdf)
      policy = report[:overtime_policy] || {}
      pdf.fill_color MUTED
      pdf.text "Hours are net of recorded breaks. Overtime uses the configured #{hours(policy[:daily_threshold_hours])}-hour daily and #{hours(policy[:weekly_threshold_hours])}-hour Sunday-Saturday weekly thresholds.", size: 7.2, leading: 2
      pdf.move_down 4
      pdf.text "This is a point-in-time report. Week finalization is shown for context but is not required to generate an export. Denied entries are excluded from hour totals.", size: 7.2, leading: 2
      pdf.move_down 4
      pdf.text "Generated by #{generated_by.full_name} through Cornerstone Operations.", size: 7.2
    end

    def render_footer(pdf)
      pdf.number_pages "Cornerstone Accounting  |  #{export.public_id}  |  Page <page> of <total>", at: [ 0, -28 ], width: pdf.bounds.width, align: :center, size: 7, color: MUTED
    end

    def readiness_title
      return "Draft - needs review" if export.readiness_status == "draft"
      return "Complete with exclusions" if excluded_count.positive?

      "Complete as of #{generated_time}"
    end

    def readiness_detail
      return issue_summary if export.readiness_status == "draft"
      return "#{excluded_count} denied #{'entry'.pluralize(excluded_count)} excluded from the hour totals." if excluded_count.positive?

      "No pending approvals or open clocks were found for this employee and period."
    end

    def issue_summary
      issues = employee[:issues] || {}
      details = []
      details << "#{issues[:pending_count]} pending approval" if issues[:pending_count].to_i.positive?
      details << "#{issues[:pending_overtime_count]} pending overtime review" if issues[:pending_overtime_count].to_i.positive?
      details << "#{issues[:open_clock_count]} open clock" if issues[:open_clock_count].to_i.positive?
      details << "#{excluded_count} denied and excluded" if excluded_count.positive?
      details.presence&.join(", ") || "Review the selected entries before using this report."
    end

    def excluded_count
      issues = employee[:issues] || {}
      issues[:denied_count].to_i + issues[:denied_overtime_count].to_i
    end

    def finalization_label
      report.dig(:finalization, :label).presence || "Not finalized"
    end

    def work_label(entry)
      [ entry.dig(:time_category, :name) || "Uncategorized", entry.dig(:service_type, :name), entry.dig(:service_task, :name) ].compact_blank.join(" / ")
    end

    def generated_time
      export.generated_at.in_time_zone(BUSINESS_TIMEZONE).strftime("%b %-d, %Y at %-I:%M %p %Z")
    end

    def branding
      @branding ||= Setting.report_branding
    end

    def contact_line
      [ branding["address"], branding["phone"], branding["email"] ].compact_blank.join(" | ")
    end

    def format_date(value)
      Date.iso8601(value.to_s).strftime("%b %-d, %Y")
    end

    def hours(value)
      format("%.2f", value.to_f)
    end

    def label(text)
      { content: text, text_color: MUTED, font_style: :bold }
    end

    def value(text)
      { content: text.to_s, text_color: INK }
    end
  end
end
