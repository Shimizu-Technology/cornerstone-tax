# frozen_string_literal: true

module Api
  module V1
    module Admin
      class SettingsController < BaseController
        before_action :authenticate_user!
        before_action :require_admin!

        # GET /api/v1/admin/settings
        def show
          render json: Setting.all_as_hash
        end

        # PUT /api/v1/admin/settings
        def update
          float_keys = %w[overtime_daily_threshold_hours overtime_weekly_threshold_hours]
          integer_keys = %w[early_clock_in_buffer_minutes]
          date_keys = %w[time_work_details_required_from]
          errors = []

          settings_params.each do |key, value|
            key_str = key.to_s
            if date_keys.include?(key_str)
              Date.iso8601(value.to_s) if value.present?
            elsif integer_keys.include?(key_str)
              numeric = Float(value)
              raise ArgumentError, "out of range" if numeric.infinite? || numeric.nan?
              errors << "#{key_str.humanize} must be a whole number" if numeric != numeric.to_i
              errors << "#{key_str.humanize} must be greater than 0" if numeric <= 0
            elsif float_keys.include?(key_str)
              numeric = Float(value)
              raise ArgumentError, "out of range" if numeric.infinite? || numeric.nan?
              errors << "#{key_str.humanize} must be greater than 0" if numeric <= 0
            end
          rescue Date::Error
            errors << "#{key.to_s.humanize} must be a date (YYYY-MM-DD) or blank"
          rescue ArgumentError, TypeError
            errors << "#{key.to_s.humanize} must be a valid number"
          end

          return render json: { error: errors.join(", ") }, status: :unprocessable_entity if errors.any?

          settings_params.each do |key, value|
            Setting.set(key, value)
          end

          render json: Setting.all_as_hash
        end

        private

        def settings_params
          params.permit(
            :contact_email,
            :notification_email,
            :report_business_name,
            :report_address,
            :report_phone,
            :report_email,
            :overtime_daily_threshold_hours,
            :overtime_weekly_threshold_hours,
            :early_clock_in_buffer_minutes,
            :time_work_details_required_from
          )
        end
      end
    end
  end
end
