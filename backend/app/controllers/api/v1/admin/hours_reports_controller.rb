# frozen_string_literal: true

module Api
  module V1
    module Admin
      class HoursReportsController < BaseController
        REPORT_PARAM_KEYS = %i[
          start_date
          end_date
          user_id
          role
          status
          time_category_id
          client_id
          service_type_id
          service_task_id
          entry_method
          approval_status
          overtime_status
          include_empty
        ].freeze

        before_action :authenticate_user!
        before_action :require_admin!

        def show
          render json: ::Payroll::HoursReportBuilder.new(report_params).call
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def pdf
          export_type = params[:user_id].present? ? "employee_timesheet_pdf" : "payroll_hours_pdf"
          send_export(export_type)
        end

        def timesheet_pdf
          send_export("employee_timesheet_pdf")
        end

        def detailed_csv
          send_export("detailed_entries_csv")
        end

        def summary_csv
          send_export("payroll_summary_csv")
        end

        private

        def report_params
          REPORT_PARAM_KEYS.index_with { |key| params[key] }.compact
        end

        def send_export(export_type)
          result = Reports::GenerateHoursReportExportService.new(
            export_type: export_type,
            report_params: report_params,
            generated_by: current_user,
            acknowledge_draft: params[:acknowledge_draft]
          ).call
          send_data result.content,
                    filename: result.filename,
                    type: result.content_type,
                    disposition: "attachment"
        rescue Reports::GenerateHoursReportExportService::DraftAcknowledgementRequired => e
          render json: {
            error: e.message,
            code: "draft_acknowledgement_required",
            issues: e.issues
          }, status: :unprocessable_entity
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end
      end
    end
  end
end
