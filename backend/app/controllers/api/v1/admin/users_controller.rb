# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < BaseController
        before_action :authenticate_user!
        before_action :require_admin!
        before_action :set_user, only: [:show, :update, :destroy, :resend_invite]

        # GET /api/v1/admin/users
        def index
          @users = User.includes(:client).order(created_at: :desc)

          # Filter by role
          if params[:role].present?
            @users = @users.where(role: params[:role])
          end

          # Filter by status
          if params[:status] == "active"
            @users = @users.where.not(clerk_id: nil).where.not("clerk_id LIKE 'pending_%'")
          elsif params[:status] == "pending"
            @users = @users.where("clerk_id IS NULL OR clerk_id LIKE 'pending_%'")
          end

          render json: {
            users: @users.map { |user| serialize_user(user) }
          }
        end

        # GET /api/v1/admin/users/:id
        def show
          render json: { user: serialize_user(@user) }
        end

        # POST /api/v1/admin/users
        # Invite a new user by email
        def create
          email = params[:email]&.downcase&.strip
          first_name = params[:first_name]&.strip
          last_name = params[:last_name]&.strip
          role = params[:role] || "employee"

          # Validate first name (required)
          if first_name.blank?
            return render json: { error: "First name is required" }, status: :unprocessable_entity
          end

          # Validate email
          if email.blank?
            return render json: { error: "Email is required" }, status: :unprocessable_entity
          end

          unless email.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/)
            return render json: { error: "Invalid email format" }, status: :unprocessable_entity
          end

          # Validate role
          unless %w[admin employee client].include?(role)
            return render json: { error: "Role must be admin, employee, or client" }, status: :unprocessable_entity
          end

          # Client role requires a client_id
          client_id = params[:client_id]
          pending_client_user_to_clear = nil
          if role == "client"
            if client_id.blank?
              return render json: { error: "Client ID is required for client role" }, status: :unprocessable_entity
            end
            unless Client.exists?(client_id)
              return render json: { error: "Client not found" }, status: :unprocessable_entity
            end
            existing_client_user = User.find_by(client_id: client_id)
            if existing_client_user
              if existing_client_user.clerk_id.present? && !existing_client_user.clerk_id.start_with?("pending_")
                return render json: { error: "This client already has a portal account" }, status: :unprocessable_entity
              else
                pending_client_user_to_clear = existing_client_user
              end
            end
          end

          # Check if email already exists — re-invite if they never activated
          existing_user = User.find_by("LOWER(email) = ?", email)
          if existing_user
            if existing_user.clerk_id.present? && !existing_user.clerk_id.start_with?("pending_")
              return render json: { error: "A user with this email already exists and has an active account" }, status: :unprocessable_entity
            end

            ActiveRecord::Base.transaction do
              if pending_client_user_to_clear && pending_client_user_to_clear.id != existing_user.id
                pending_client_user_to_clear.update_columns(client_id: nil)
              end
              existing_user.update!(
                first_name: first_name,
                last_name: last_name.presence,
                role: role,
                client_id: role == "client" ? client_id : nil,
                clerk_id: "pending_#{SecureRandom.hex(8)}"
              )
            end
            email_sent = send_invitation_email(existing_user)
            return render json: { user: serialize_user(existing_user), invitation_email_sent: email_sent }, status: :created
          end

          # Create a new user
          ActiveRecord::Base.transaction do
            if pending_client_user_to_clear
              pending_client_user_to_clear.update_columns(client_id: nil)
            end
            @user = User.create!(
              email: email,
              first_name: first_name,
              last_name: last_name.presence,
              role: role,
              client_id: role == "client" ? client_id : nil,
              clerk_id: "pending_#{SecureRandom.hex(8)}"
            )
          end
          email_sent = send_invitation_email(@user)
          render json: { user: serialize_user(@user), invitation_email_sent: email_sent }, status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.record.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end

        # PATCH /api/v1/admin/users/:id
        def update
          # Prevent changing own role (safety)
          if @user.id == current_user.id && params[:role].present? && params[:role] != current_user.role
            return render json: { error: "You cannot change your own role" }, status: :unprocessable_entity
          end

          permitted = {}
          if params[:role].present? && %w[admin employee client].include?(params[:role])
            new_role = params[:role]

            if new_role == "client" && @user.client_id.blank?
              return render json: { error: "Cannot set role to client without a linked client profile" }, status: :unprocessable_entity
            end

            permitted[:role] = new_role
          end

          if @user.update(permitted)
            render json: { user: serialize_user(@user) }
          else
            render json: { error: @user.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/admin/users/:id
        def destroy
          # Prevent deleting yourself
          if @user.id == current_user.id
            return render json: { error: "You cannot delete your own account" }, status: :unprocessable_entity
          end

          # Soft delete by clearing clerk_id and marking as inactive
          # Or we can just destroy - for now let's just destroy
          @user.destroy
          head :no_content
        end

        # POST /api/v1/admin/users/:id/resend_invite
        def resend_invite
          unless @user.clerk_id.blank? || @user.clerk_id.start_with?("pending_")
            return render json: { error: "This user has already activated their account" }, status: :unprocessable_entity
          end

          cache_key = "resend_invite_cooldown:#{@user.id}"
          unless Rails.cache.write(cache_key, true, expires_in: 1.minute, unless_exist: true)
            return render json: { error: "Invitation was already sent recently. Please wait a minute before resending." }, status: :too_many_requests
          end

          email_sent = send_invitation_email(@user)

          unless email_sent
            Rails.cache.delete(cache_key)
            return render json: { error: "Failed to send invitation email. Please check email configuration." }, status: :unprocessable_entity
          end

          render json: { message: "Invitation email resent to #{@user.email}" }
        end

        private

        def set_user
          @user = User.includes(:client).find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { error: "User not found" }, status: :not_found
        end

        def serialize_user(user)
          {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: user.display_name,
            full_name: user.full_name,
            role: user.role,
            client_id: user.client_id,
            client_name: user.client&.full_name,
            is_active: user.clerk_id.present? && !user.clerk_id.start_with?("pending_"),
            is_pending: user.clerk_id.blank? || user.clerk_id.start_with?("pending_"),
            created_at: user.created_at.iso8601,
            updated_at: user.updated_at.iso8601
          }
        end

        def send_invitation_email(user)
          sent = EmailService.send_invitation_email(user: user, invited_by: current_user)
          if sent
            Rails.logger.info "Invitation email sent to #{user.email}"
          else
            Rails.logger.warn "Invitation email could not be sent to #{user.email}"
          end
          sent
        end
      end
    end
  end
end
