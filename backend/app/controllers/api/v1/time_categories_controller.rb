# frozen_string_literal: true

module Api
  module V1
    class TimeCategoriesController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!

      # GET /api/v1/time_categories
      # Returns active time categories for dropdown selection
      def index
        @categories = TimeCategory.active.order(:name)

        render json: {
          time_categories: @categories.map { |cat| serialize_category(cat) }
        }
      end

      private

      def serialize_category(category)
        {
          id: category.id,
          name: category.name,
          description: category.description
        }
      end
    end
  end
end
