# frozen_string_literal: true

module Api
  module V1
    module Portal
      class SettingsController < BaseController
        # GET /api/v1/portal/settings
        def show
          render json: {
            notification_preference: current_client.notification_preference
          }
        end

        # PATCH /api/v1/portal/settings
        def update
          if current_client.update(notification_preference: params[:notification_preference])
            render json: {
              notification_preference: current_client.notification_preference
            }
          else
            render json: { error: current_client.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
