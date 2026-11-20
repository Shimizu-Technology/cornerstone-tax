# frozen_string_literal: true

module Api
  module V1
    module Payroll
      # GET /api/v1/payroll/work_hours?start=YYYY-MM-DD&end=YYYY-MM-DD
      # Service-to-service feed for Cornerstone Payroll; see
      # docs/PAYROLL_WORK_HOURS_FEED.md. Requests are signed with HMAC-SHA256
      # using PAYROLL_WORK_HOURS_SECRET (separate from the time summary's
      # PAYROLL_SHARED_SECRET); see Payroll::WorkHoursSignature. Read-only:
      # no export snapshot, no entry protection.
      class WorkHoursController < ApplicationController
        SECRET_ENV = "PAYROLL_WORK_HOURS_SECRET"

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
          secret = ENV[SECRET_ENV].to_s
          if secret.blank?
            Rails.logger.error("#{SECRET_ENV} is not configured")
            return render json: { error: "Service unavailable" }, status: :service_unavailable
          end

          problem = ::Payroll::WorkHoursSignature.verify(secret: secret, request: request)
          return if problem.nil?

          render json: { error: "Unauthorized: #{problem}" }, status: :unauthorized
        end
      end
    end
  end
end
