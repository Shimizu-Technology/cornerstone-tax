# frozen_string_literal: true

module Api
  module V1
    class BaseController < ApplicationController
      include ClerkAuthenticatable

      rescue_from StandardError, with: :internal_server_error
      rescue_from ActionController::ParameterMissing, with: :bad_request
      rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      # Backstop: lock order (users, then entries; see User::ROW_MUTEX) should
      # prevent deadlocks, but if PostgreSQL still picks this request as the
      # victim, nothing was saved and a retry is safe.
      rescue_from ActiveRecord::Deadlocked, with: :retry_later

      private

      def not_found(_exception)
        render json: { error: 'Record not found' }, status: :not_found
      end

      def unprocessable_entity(exception)
        render json: { error: exception.message, errors: exception.record&.errors&.full_messages }, status: :unprocessable_entity
      end

      def bad_request(exception)
        render json: { error: exception.message }, status: :bad_request
      end

      def retry_later(exception)
        Rails.logger.warn("Deadlock, asked the client to retry: #{exception.message.lines.first&.strip}")
        render json: { error: "Someone else was saving this at the same time. Please try again.", code: "retry" }, status: :conflict
      end

      def internal_server_error(exception)
        Rails.logger.error("Unhandled exception: #{exception.class} - #{exception.message}")
        Rails.logger.error(exception.backtrace&.first(20)&.join("\n"))
        render json: { error: 'Internal server error', errors: ['An unexpected error occurred. Please try again later.'] }, status: :internal_server_error
      end
    end
  end
end
