# frozen_string_literal: true

module Api
  module V1
    module Portal
      class BaseController < Api::V1::BaseController
        before_action :authenticate_user!
        before_action :require_client!

        private

        def current_client
          @current_client ||= current_user.client
        end
      end
    end
  end
end
