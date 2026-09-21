# frozen_string_literal: true

module Api
  module V1
    class UsersController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!

      # GET /api/v1/users
      # Returns list of staff users (for assignment dropdowns)
      def index
        users = if current_user.admin? && ActiveModel::Type::Boolean.new.cast(params[:include_terminated])
          User.staff
        else
          User.active_staff
        end
        users = users.order(:first_name, :last_name)

        render json: {
          users: users.map do |user|
            {
              id: user.id,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              display_name: user.display_name,
              full_name: user.full_name,
              role: user.role,
              employment_status: user.employment_status,
              termination_effective_on: user.termination_effective_on&.iso8601
            }
          end
        }
      end
    end
  end
end
