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
          settings_params.each do |key, value|
            Setting.set(key, value)
          end

          render json: Setting.all_as_hash
        end

        private

        def settings_params
          params.permit(:contact_email)
        end
      end
    end
  end
end
