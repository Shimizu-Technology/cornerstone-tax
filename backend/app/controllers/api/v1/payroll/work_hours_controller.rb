# frozen_string_literal: true

module Api
  module V1
    module Payroll
      # GET /api/v1/payroll/work_hours?start=YYYY-MM-DD&end=YYYY-MM-DD
      # Service-to-service feed for Cornerstone Payroll; see
      # docs/PAYROLL_WORK_HOURS_V1.md. Authenticated with its own secret
      # (PAYROLL_WORK_HOURS_SECRET, header X-Work-Hours-Secret), separate from
      # the time summary's PAYROLL_SHARED_SECRET. Read-only: no export
      # snapshot, no entry protection.
      class WorkHoursController < ApplicationController
        SECRET_ENV = "PAYROLL_WORK_HOURS_SECRET"
        SECRET_HEADER = "X-Work-Hours-Secret"

        before_action :authenticate_work_hours_secret!

        def show
          render json: ::Payroll::WorkHoursBuilder.new(
            start_date: params[:start].presence || params[:start_date],
            end_date: params[:end].presence || params[:end_date]
          ).call
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def authenticate_work_hours_secret!
          expected = ENV[SECRET_ENV].to_s
          if expected.blank?
            Rails.logger.error("#{SECRET_ENV} is not configured")
            return render json: { error: "Service unavailable" }, status: :service_unavailable
          end

          provided = request.headers[SECRET_HEADER].to_s
          # secure_compare digests both values first, so it takes the same
          # time whatever the provided value's length or content.
          return if provided.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)

          render json: { error: "Invalid or missing #{SECRET_HEADER} header" }, status: :unauthorized
        end
      end
    end
  end
end
