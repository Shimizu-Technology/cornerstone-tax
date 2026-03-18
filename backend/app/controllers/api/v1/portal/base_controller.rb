# frozen_string_literal: true

module Api
  module V1
    module Portal
      class BaseController < Api::V1::BaseController
        before_action :authenticate_user!
        before_action :require_client!
        before_action :ensure_client_exists!

        private

        def current_client
          @current_client ||= current_user.client
        end

        def ensure_client_exists!
          unless current_client
            render json: { error: "Client profile not found. Please contact support." }, status: :forbidden
          end
        end
      end
    end
  end
end
