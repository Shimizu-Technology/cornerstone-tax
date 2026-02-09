# frozen_string_literal: true

module Api
  module V1
    class AuthController < BaseController
      # GET/POST /api/v1/auth/me
      # Returns the current authenticated user
      # Used by frontend to verify authentication and get user info
      # Handles linking invited users via email from Clerk
      
      # Skip the standard authenticate_user! - we handle it custom here
      skip_before_action :authenticate_user!, only: [:me], raise: false

      def me
        header = request.headers["Authorization"]

        unless header.present?
          return render json: { error: "Missing authorization header" }, status: :unauthorized
        end

        token = header.split(" ").last
        decoded = ClerkAuth.verify(token)

        unless decoded
          return render json: { error: "Invalid or expired token" }, status: :unauthorized
        end

        # Use email from params (sent by frontend from Clerk) - more reliable than JWT
        email = params[:email].presence || decoded["email"] || decoded["primary_email_address"]

        user = find_or_create_user(
          clerk_id: decoded["sub"],
          email: email,
          first_name: decoded["first_name"],
          last_name: decoded["last_name"]
        )

        if user.nil?
          return render json: { 
            error: "Access denied. You haven't been invited to this system. Please contact an administrator." 
          }, status: :forbidden
        end

        render json: {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            role: user.role,
            is_admin: user.admin?,
            is_staff: user.staff?,
            created_at: user.created_at
          }
        }
      end
    end
  end
end
