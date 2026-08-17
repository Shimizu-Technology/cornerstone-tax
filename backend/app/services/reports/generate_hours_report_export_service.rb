# frozen_string_literal: true

module Reports
  class GenerateHoursReportExportService
    Result = Data.define(:content, :filename, :content_type)

    class DraftAcknowledgementRequired < StandardError
      attr_reader :issues

      def initialize(issues)
        @issues = issues
        super("This report still has pending approvals or open clocks. Confirm a draft export to continue.")
      end
    end

    EXPORT_TYPES = %w[payroll_hours_pdf employee_timesheet_pdf detailed_entries_csv payroll_summary_csv].freeze

    def initialize(export_type:, report_params:, generated_by:, acknowledge_draft: false)
      @export_type = export_type
      @report_params = report_params.to_h.symbolize_keys
      @generated_by = generated_by
      @acknowledge_draft = ActiveModel::Type::Boolean.new.cast(acknowledge_draft)
    end

    def call
      validate_export_type!
      report = build_report
      validate_employee_selection!(report)
      require_draft_acknowledgement!(report)

      content = ReportExport.transaction do
        export = ReportExport.capture!(
          export_type: export_type,
          report: report,
          generated_by: generated_by,
          protects_entries: true
        )
        render_content(report, export)
      end

      Result.new(
        content: content,
        filename: filename(report),
        content_type: pdf? ? "application/pdf" : "text/csv; charset=utf-8"
      )
    end

    private

    attr_reader :export_type, :report_params, :generated_by, :acknowledge_draft

    def validate_export_type!
      return if export_type.in?(EXPORT_TYPES)

      raise ArgumentError, "Unsupported report export type"
    end

    def build_report
      ::Payroll::HoursReportBuilder.new(employee_timesheet? ? employee_report_params : report_params).call
    end

    # An employee timesheet is the complete approved/standard ledger for the
    # chosen person and dates. Display filters must not silently remove entries
    # from an official timesheet.
    def employee_report_params
      {
        start_date: report_params[:start_date],
        end_date: report_params[:end_date],
        user_id: report_params[:user_id],
        approval_status: "approved_or_standard"
      }
    end

    def validate_employee_selection!(report)
      return unless employee_timesheet?
      return if report_params[:user_id].present? && report[:employees].length == 1

      raise ArgumentError, "Select exactly one employee to download a timesheet PDF"
    end

    def require_draft_acknowledgement!(report)
      return if report[:ready] || acknowledge_draft

      issues = report[:summary].slice(
        :pending_count,
        :denied_count,
        :pending_overtime_count,
        :denied_overtime_count,
        :open_clock_count
      )
      raise DraftAcknowledgementRequired, issues
    end

    def render_content(report, export)
      case export_type
      when "payroll_hours_pdf"
        PayrollHoursPdf.new(report: report, export: export, generated_by: generated_by).render
      when "employee_timesheet_pdf"
        EmployeeTimesheetPdf.new(report: report, export: export, generated_by: generated_by).render
      when "detailed_entries_csv"
        HoursReportCsv.detailed(report: report, export: export)
      when "payroll_summary_csv"
        HoursReportCsv.summary(report: report, export: export)
      end
    end

    def filename(report)
      period = "#{report[:start_date]}_to_#{report[:end_date]}"
      case export_type
      when "payroll_hours_pdf" then "Cornerstone_Payroll_Hours_#{period}.pdf"
      when "employee_timesheet_pdf" then "Cornerstone_Timesheet_#{safe_filename(report.dig(:employees, 0, :full_name))}_#{period}.pdf"
      when "detailed_entries_csv" then "Cornerstone_Detailed_Time_#{period}.csv"
      when "payroll_summary_csv" then "Cornerstone_Payroll_Summary_#{period}.csv"
      end
    end

    def safe_filename(value)
      ActiveSupport::Inflector.transliterate(value.to_s)
        .gsub(/[^A-Za-z0-9]+/, "_")
        .gsub(/\A_+|_+\z/, "")
        .presence || "Employee"
    end

    def pdf?
      export_type.end_with?("_pdf")
    end

    def employee_timesheet?
      export_type == "employee_timesheet_pdf"
    end
  end
end
