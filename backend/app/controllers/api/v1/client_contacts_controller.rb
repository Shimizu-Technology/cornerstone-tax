# frozen_string_literal: true

module Api
  module V1
    class ClientContactsController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!
      before_action :set_client
      before_action :set_contact, only: [:update, :destroy]

      # GET /api/v1/clients/:client_id/contacts
      def index
        render json: { contacts: @client.client_contacts.order(is_primary: :desc, created_at: :asc).map { |c| serialize_contact(c) } }
      end

      # POST /api/v1/clients/:client_id/contacts
      def create
        contact = @client.client_contacts.new(contact_params)
        contact.is_primary = contact_primary?

        ActiveRecord::Base.transaction do
          # Lock client's contacts to prevent race conditions with is_primary
          @client.client_contacts.lock.load if contact.is_primary

          if contact.save
            ensure_primary_contact(contact)
            AuditLog.log(
              auditable: @client,
              action: "updated",
              user: current_user,
              changes_made: { contact: { action: "created", name: contact.full_name } },
              metadata: "Added contact #{contact.full_name}"
            )
            render json: { contact: serialize_contact(contact) }, status: :created
          else
            render json: { error: contact.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordNotUnique
        render json: { error: "Another primary contact was set concurrently. Please try again." }, status: :conflict
      end

      # PATCH /api/v1/clients/:client_id/contacts/:id
      def update
        @contact.assign_attributes(contact_params)
        @contact.is_primary = contact_primary? if params[:contact].key?(:is_primary)

        ActiveRecord::Base.transaction do
          # Lock client's contacts to prevent race conditions with is_primary
          @client.client_contacts.lock.load if @contact.is_primary

          if @contact.save
            ensure_primary_contact(@contact)
            AuditLog.log(
              auditable: @client,
              action: "updated",
              user: current_user,
              changes_made: { contact: { action: "updated", name: @contact.full_name } },
              metadata: "Updated contact #{@contact.full_name}"
            )
            render json: { contact: serialize_contact(@contact) }
          else
            render json: { error: @contact.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordNotUnique
        render json: { error: "Another primary contact was set concurrently. Please try again." }, status: :conflict
      end

      # DELETE /api/v1/clients/:client_id/contacts/:id
      def destroy
        if @client.client_type == "business" && @client.client_contacts.count == 1
          return render json: { error: "Business clients must have at least one contact" }, status: :unprocessable_entity
        end

        @contact.destroy
        AuditLog.log(
          auditable: @client,
          action: "updated",
          user: current_user,
          changes_made: { contact: { action: "deleted", name: @contact.full_name } },
          metadata: "Deleted contact #{@contact.full_name}"
        )
        head :no_content
      end

      private

      def set_client
        @client = Client.find(params[:client_id])
      end

      def set_contact
        @contact = @client.client_contacts.find(params[:id])
      end

      def contact_params
        contact = params.require(:contact)
        {
          first_name: contact[:first_name],
          last_name: contact[:last_name],
          email: contact[:email],
          phone: contact[:phone],
          role: contact[:role]
        }
      end

      def contact_primary?
        ActiveModel::Type::Boolean.new.cast(params.dig(:contact, :is_primary))
      end

      def ensure_primary_contact(contact)
        return unless contact.is_primary

        @client.client_contacts.where(is_primary: true).where.not(id: contact.id).update_all(is_primary: false)
      end

      def serialize_contact(contact)
        {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          role: contact.role,
          is_primary: contact.is_primary,
          created_at: contact.created_at.iso8601,
          updated_at: contact.updated_at.iso8601
        }
      end
    end
  end
end
