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
          numeric_keys = %w[overtime_daily_threshold_hours overtime_weekly_threshold_hours early_clock_in_buffer_minutes]
          errors = []

          settings_params.each do |key, value|
            if numeric_keys.include?(key.to_s)
              numeric = Float(value)
              errors << "#{key.to_s.humanize} must be greater than 0" if numeric <= 0
            rescue ArgumentError, TypeError
              errors << "#{key.to_s.humanize} must be a valid number"
            end
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
            :overtime_daily_threshold_hours,
            :overtime_weekly_threshold_hours,
            :early_clock_in_buffer_minutes
          )
        end
      end
    end
  end
end
