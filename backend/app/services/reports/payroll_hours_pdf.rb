# frozen_string_literal: true

require "prawn"
require "prawn/table"

module Reports
  class PayrollHoursPdf
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
    SOFT_ROW = "FAF8F6"

    def initialize(report:, export:, generated_by:)
      @report = report
      @export = export
      @generated_by = generated_by
    end

    def render
      Prawn::Document.new(page_size: "LETTER", page_layout: :landscape, margin: [ 38, 36, 46, 36 ], info: metadata) do |pdf|
        PdfTypography.apply(pdf)
        render_header(pdf, "PAYROLL HOURS REPORT")
        render_identity(pdf)
        render_status(pdf)
        render_summary(pdf)
        render_employee_summary(pdf)
        render_notes(pdf)
        render_employee_pages(pdf)
        render_footer(pdf)
      end.render
    end

    private

    attr_reader :report, :export, :generated_by

    def metadata
      {
        Title: "Cornerstone Payroll Hours Report",
        Author: branding["business_name"],
        Subject: "Payroll hours from #{report[:start_date]} to #{report[:end_date]}",
        Creator: "Cornerstone Operations"
      }
    end

    def render_header(pdf, title)
      top = pdf.cursor
      pdf.fill_color PRIMARY_DARK
      pdf.text_box "CORNERSTONE", at: [ 0, top ], width: 250, height: 28, size: 20, style: :bold, character_spacing: 0.6
      pdf.fill_color INK
      pdf.text_box title, at: [ 350, top - 2 ], width: 370, height: 22, align: :right, size: 14, style: :bold
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
        [ label("Period"), value("#{format_date(report[:start_date])} to #{format_date(report[:end_date])}"), label("Generated"), value(generated_time) ],
        [ label("Employees"), value(summary[:employee_count]), label("Reference"), value(export.public_id) ]
      ]
      pdf.table(details, width: pdf.bounds.width, column_widths: [ 75, 285, 75, 285 ], cell_style: { borders: [], padding: [ 2, 0, 5, 0 ], size: 8.5 })
      pdf.move_down 8
    end

    def render_status(pdf)
      complete = export.readiness_status == "complete"
      pdf.fill_color complete ? LIGHT_GREEN : LIGHT_AMBER
      pdf.fill_rounded_rectangle [ 0, pdf.cursor ], pdf.bounds.width, 50, 6
      pdf.fill_color complete ? GREEN : AMBER
      pdf.text_box readiness_title, at: [ 12, pdf.cursor - 9 ], width: 435, height: 15, size: 9.5, style: :bold
      pdf.fill_color MUTED
      pdf.text_box readiness_detail, at: [ 12, pdf.cursor - 23 ], width: 435, height: 22, size: 7.2, leading: 1
      pdf.fill_color PRIMARY_DARK
      pdf.text_box "Finalization coverage", at: [ 475, pdf.cursor - 9 ], width: 243, height: 14, size: 7.2, style: :bold, align: :right
      pdf.fill_color MUTED
      pdf.text_box finalization_label, at: [ 475, pdf.cursor - 22 ], width: 243, height: 22, size: 7.2, align: :right
      pdf.move_down 60
    end

    def render_summary(pdf)
      rows = [
        [ "Total Hours", "Regular", "Overtime", "Break Hours", "Employees", "Entries" ],
        [ hours(summary[:total_hours]), hours(summary[:regular_hours]), hours(summary[:overtime_hours]), hours(summary[:break_hours]), summary[:employee_count].to_i.to_s, summary[:entries_count].to_i.to_s ]
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
      pdf.move_down 15
    end

    def render_employee_summary(pdf)
      pdf.fill_color INK
      pdf.text "Hours by Employee", size: 11.5, style: :bold
      pdf.move_down 6

      rows = [ [ "Employee", "Role", "Status", "Regular", "OT", "Total", "Break", "Entries" ] ]
      employees.each do |employee|
        rows << [
          employee[:full_name],
          employee[:role].to_s.capitalize,
          employee_status(employee),
          hours(employee[:regular_hours]),
          hours(employee[:overtime_hours]),
          hours(employee[:total_hours]),
          hours(employee[:break_hours]),
          employee[:entries_count].to_i.to_s
        ]
      end
      rows << [ { content: "No matching employees or time entries for this report.", colspan: 8 } ] if employees.empty?

      pdf.table(rows, header: true, width: pdf.bounds.width, column_widths: [ 220, 85, 110, 65, 60, 65, 60, 55 ], cell_style: { size: 7.8, padding: [ 6, 5 ], border_color: BORDER }) do |table|
        table.row_colors = [ "FFFFFF", SOFT_ROW ] if rows.length > 2
        table.row(0).background_color = SOFT
        table.row(0).text_color = PRIMARY_DARK
        table.row(0).font_style = :bold
        table.columns(3..7).align = :right
      end
      pdf.move_down 13
    end

    def render_notes(pdf)
      policy = report[:overtime_policy] || {}
      pdf.fill_color MUTED
      pdf.text "Employee detail pages omit client names and tax-return identifiers by default. Use the internal detailed CSV only when client-level operational detail is required.", size: 7.2, leading: 2
      pdf.move_down 4
      pdf.text "Hours are net of recorded breaks. Overtime uses the configured #{hours(policy[:daily_threshold_hours])}-hour daily and #{hours(policy[:weekly_threshold_hours])}-hour Sunday-Saturday weekly thresholds.", size: 7.2, leading: 2
      pdf.move_down 4
      pdf.text "This point-in-time report does not require finalized weeks. Generated by #{generated_by.full_name} through Cornerstone Operations.", size: 7.2
    end

    def render_employee_pages(pdf)
      employees.each do |employee|
        pdf.start_new_page
        pdf.move_cursor_to pdf.bounds.top
        render_header(pdf, "EMPLOYEE DETAIL")
        render_employee_identity(pdf, employee)
        render_employee_entries(pdf, employee)
        render_weekly_totals(pdf, employee)
        render_employee_totals(pdf, employee)
      end
    end

    def render_employee_identity(pdf, employee)
      pdf.fill_color INK
      pdf.text employee[:full_name].to_s, size: 15, style: :bold
      pdf.move_down 3
      pdf.fill_color MUTED
      pdf.text [ employee[:role].to_s.capitalize, employee[:status].to_s.capitalize, employee_status(employee) ].compact_blank.join("  |  "), size: 7.8
      pdf.move_down 11
    end

    def render_employee_entries(pdf, employee)
      rows = [ [ "Date", "Start", "End", "Break", "Category / Service", "Approval", "Regular", "OT", "Total" ] ]
      Array(employee[:days]).each do |day|
        Array(day[:entries]).each do |entry|
          rows << [
            format_date(entry[:work_date]),
            entry[:formatted_start_time] || "Open",
            entry[:formatted_end_time] || "Open",
            entry[:break_minutes].to_i.zero? ? "-" : "#{entry[:break_minutes]}m",
            work_label(entry),
            entry[:approval_status].to_s.presence&.capitalize || "Standard",
            hours(entry[:regular_hours]),
            hours(entry[:overtime_hours]),
            hours(entry[:total_hours])
          ]
        end
      end
      rows << [ { content: "No included entries for this employee and period.", colspan: 9 } ] if rows.one?

      pdf.table(rows, header: true, width: pdf.bounds.width, column_widths: [ 62, 50, 50, 42, 290, 72, 54, 46, 54 ], cell_style: { size: 7, padding: [ 5, 4 ], border_color: BORDER }) do |table|
        table.row_colors = [ "FFFFFF", SOFT_ROW ] if rows.length > 2
        table.row(0).background_color = PRIMARY_DARK
        table.row(0).text_color = "FFFFFF"
        table.row(0).font_style = :bold
        table.columns(6..8).align = :right
      end
      pdf.move_down 13
    end

    def render_weekly_totals(pdf, employee)
      weeks = Array(employee[:weeks])
      return if weeks.empty?

      ensure_totals_space(pdf, employee, weeks.length)
      pdf.fill_color INK
      pdf.text "Weekly Totals", size: 10, style: :bold
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
      pdf.table(rows, header: true, width: pdf.bounds.width, cell_style: { size: 7.4, padding: [ 5, 5 ], border_color: BORDER }) do |table|
        table.row(0).background_color = SOFT
        table.row(0).text_color = PRIMARY_DARK
        table.row(0).font_style = :bold
        table.columns(1..4).align = :right
      end
      pdf.move_down 11
    end

    def ensure_totals_space(pdf, employee, week_count)
      required_height = 105 + (week_count * 21)
      return if pdf.cursor >= required_height

      pdf.start_new_page
      pdf.fill_color PRIMARY_DARK
      pdf.text "#{employee[:full_name]} - totals continued", size: 10, style: :bold
      pdf.move_down 9
    end

    def render_employee_totals(pdf, employee)
      rows = [
        [ "Regular Hours", "Overtime Hours", "Total Hours", "Break Hours", "Entries" ],
        [ hours(employee[:regular_hours]), hours(employee[:overtime_hours]), hours(employee[:total_hours]), hours(employee[:break_hours]), employee[:entries_count].to_i.to_s ]
      ]
      pdf.table(rows, width: pdf.bounds.width, cell_style: { align: :center, padding: [ 7, 5 ], border_color: BORDER }) do |table|
        table.row(0).background_color = PRIMARY_DARK
        table.row(0).text_color = "FFFFFF"
        table.row(0).font_style = :bold
        table.row(0).size = 7.3
        table.row(1).text_color = PRIMARY
        table.row(1).font_style = :bold
        table.row(1).size = 10.8
      end
    end

    def render_footer(pdf)
      pdf.number_pages "Cornerstone Accounting  |  #{export.public_id}  |  Page <page> of <total>", at: [ 0, -28 ], width: pdf.bounds.width, align: :center, size: 7, color: MUTED
    end

    def employee_status(employee)
      issues = employee[:issues] || {}
      blocking = issues[:pending_count].to_i + issues[:pending_overtime_count].to_i + issues[:open_clock_count].to_i
      excluded = issues[:denied_count].to_i + issues[:denied_overtime_count].to_i
      return "Draft" if blocking.positive?
      return "Complete with exclusions" if excluded.positive?

      "Complete"
    end

    def readiness_title
      return "Draft - needs review" if export.readiness_status == "draft"
      return "Complete with exclusions" if excluded_count.positive?

      "Complete as of #{generated_time}"
    end

    def readiness_detail
      details = []
      details << "#{summary[:pending_count]} pending approval" if summary[:pending_count].to_i.positive?
      details << "#{summary[:pending_overtime_count]} pending overtime review" if summary[:pending_overtime_count].to_i.positive?
      details << "#{summary[:open_clock_count]} open clock" if summary[:open_clock_count].to_i.positive?
      details << "#{excluded_count} denied and excluded" if excluded_count.positive?
      details.presence&.join(", ") || "No pending approvals or open clocks were found in this period."
    end

    def excluded_count
      summary[:denied_count].to_i + summary[:denied_overtime_count].to_i
    end

    def finalization_label
      report.dig(:finalization, :label).presence || "Not finalized"
    end

    def work_label(entry)
      [ entry.dig(:time_category, :name) || "Uncategorized", entry.dig(:service_type, :name), entry.dig(:service_task, :name) ].compact_blank.join(" / ")
    end

    def employees
      @employees ||= Array(report[:employees])
    end

    def summary
      report[:summary] || {}
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
