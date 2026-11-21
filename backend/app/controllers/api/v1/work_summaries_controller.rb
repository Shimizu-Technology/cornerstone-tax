# frozen_string_literal: true

module Api
  module V1
    # GET /api/v1/work_summary(.csv|.pdf)?start_date=&end_date=[&user_id=]
    # A person's pay-period work summary. Staff see their own; admins can
    # pass user_id to see anyone's.
    class WorkSummariesController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!
      before_action :only_admins_see_others

      def show
        render json: build
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def csv
        summary = build
        send_data Reports::WorkSummaryCsv.call(summary), filename: filename(summary, "csv"), type: "text/csv", disposition: "attachment"
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      def pdf
        summary = build
        send_data Reports::WorkSummaryPdf.new(summary).render, filename: filename(summary, "pdf"), type: "application/pdf", disposition: "attachment"
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/work_summary/pay_periods
      # The current and previous pay period under Settings > Pay schedule.
      def pay_periods
        render json: PaySchedule.current_and_previous
      end

      private

      def build
        Reports::WorkSummaryBuilder.new(user: summary_user, start_date: params[:start_date], end_date: params[:end_date]).call
      end

      def own_summary?
        params[:user_id].blank? || params[:user_id].to_i == current_user.id
      end

      def only_admins_see_others
        return if own_summary? || current_user.admin?

        render json: { error: "You can only see your own work summary" }, status: :forbidden
      end

      def summary_user
        own_summary? ? current_user : User.staff.find(params[:user_id])
      end

      def filename(summary, extension)
        name = summary.dig(:user, :full_name).to_s.parameterize.presence || "staff"
        "Work_Summary_#{name}_#{summary[:start_date]}_to_#{summary[:end_date]}.#{extension}"
      end
    end
  end
end
