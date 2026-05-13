# frozen_string_literal: true

module Api
  module V1
    class TaxReturnsController < BaseController
      SUMMARY_INCLUDES = [{ client: :user }, :workflow_stage, :assigned_to].freeze
      DETAIL_INCLUDES = [
        { client: :user },
        :workflow_stage,
        :assigned_to,
        :reviewed_by,
        :income_sources,
        { documents: :uploaded_by },
        { workflow_events: :user }
      ].freeze

      # Require authentication and staff role for all actions
      before_action :authenticate_user!
      before_action :require_staff!

      # GET /api/v1/tax_returns
      def index
        returns = TaxReturn.includes(*SUMMARY_INCLUDES)
                           .order(created_at: :desc)

        # Filter by stage
        if params[:stage].present?
          returns = returns.joins(:workflow_stage)
                           .where(workflow_stages: { slug: params[:stage] })
        end

        # Filter by year
        if params[:year].present?
          returns = returns.where(tax_year: params[:year])
        end

        # Filter by assigned user
        if params[:assigned_to].present?
          returns = returns.where(assigned_to_id: params[:assigned_to])
        end

        if params[:payment_status].present?
          returns = returns.where(payment_status: params[:payment_status])
        end

        if params[:filing_status].present?
          returns = returns.where(filing_status: params[:filing_status])
        end

        if params[:return_type].present?
          returns = returns.where(return_type: params[:return_type])
        end

        if params[:portal_visible].present?
          returns = returns.where(portal_visible: ActiveModel::Type::Boolean.new.cast(params[:portal_visible]))
        end

        # Search by client name
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          returns = returns.joins(:client).where(
            "LOWER(clients.first_name) LIKE ? OR LOWER(clients.last_name) LIKE ? OR LOWER(clients.email) LIKE ? OR LOWER(clients.business_name) LIKE ?",
            search_term, search_term, search_term, search_term
          )
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i.clamp(1, 100)
        total_count = returns.count
        returns = returns.offset((page - 1) * per_page).limit(per_page)

        render json: {
          tax_returns: returns.map { |tr| tax_return_summary(tr) },
          meta: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/tax_returns/:id
      def show
        tax_return = tax_return_detail_scope.find(params[:id])

        render json: { tax_return: tax_return_detail(tax_return) }
      end

      # POST /api/v1/tax_returns
      def create
        tax_return = TaxReturn.new(tax_return_create_params)
        tax_return.current_actor = current_user
        tax_return.received_at ||= Time.current

        TaxReturn.transaction do
          tax_return.client ||= create_client_for_return!
          tax_return.save!
          log_return_created_event(tax_return)
        end

        render json: { tax_return: tax_return_detail(tax_return_detail_scope.find(tax_return.id)) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotUnique
        render json: {
          errors: ["A tax return with these client, year, return type, and form details already exists"]
        }, status: :unprocessable_entity
      end

      # PATCH /api/v1/tax_returns/:id
      def update
        tax_return = TaxReturn.find(params[:id])
        tax_return.current_actor = current_user  # For audit logging

        if tax_return.update(tax_return_params)
          render json: { tax_return: tax_return_summary(tax_return_summary_scope.find(tax_return.id)) }
        else
          render json: { errors: tax_return.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/tax_returns/:id/assign
      def assign
        tax_return = TaxReturn.find(params[:id])
        user = User.find(params[:user_id])
        tax_return.current_actor = current_user  # For audit logging

        tax_return.update!(assigned_to: user)

        render json: {
          message: "Tax return assigned to #{user.full_name}",
          tax_return: tax_return_summary(tax_return_summary_scope.find(tax_return.id))
        }
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: e.message }, status: :not_found
      end

      private

      def tax_return_summary_scope
        TaxReturn.includes(*SUMMARY_INCLUDES)
      end

      def tax_return_detail_scope
        TaxReturn.includes(*DETAIL_INCLUDES)
      end

      def tax_return_params
        params.require(:tax_return).permit(
          :workflow_stage_id, :assigned_to_id, :reviewed_by_id, :notes,
          :return_type, :form_type, :jurisdiction, :source, :priority,
          :received_at, :due_on,
          :payment_status, :base_fee_cents, :discount_amount_cents,
          :discount_reason, :amount_paid_cents, :paid_at, :payment_notes,
          :filing_status, :filed_at, :drt_confirmation, :irs_confirmation,
          :portal_visible, :documents_enabled, :signature_status,
          :signature_requested_at, :signed_at, :tax_outcome_status,
          :tax_outcome_amount_cents, :tax_outcome_notes,
          fee_line_items: [:label, :amount_cents, :notes]
        ).tap do |permitted|
          permitted[:fee_line_items] = sanitize_fee_line_items(permitted[:fee_line_items]) if permitted.key?(:fee_line_items)
        end
      end

      def tax_return_client_params
        raw_attrs = params.require(:tax_return)[:client_attributes]
        attrs = raw_attrs.respond_to?(:permit) ? raw_attrs : ActionController::Parameters.new(raw_attrs || {})
        attrs.permit(
          :client_type, :business_name, :first_name, :last_name, :email, :phone,
          :date_of_birth, :filing_status
        )
      end

      def tax_return_create_params
        params.require(:tax_return).permit(
          :client_id, :tax_year, :workflow_stage_id, :assigned_to_id,
          :reviewed_by_id, :notes, :return_type, :form_type, :jurisdiction,
          :source, :priority, :received_at, :due_on, :payment_status,
          :base_fee_cents, :discount_amount_cents, :discount_reason,
          :amount_paid_cents, :paid_at, :payment_notes, :filing_status,
          :filed_at, :drt_confirmation, :irs_confirmation, :portal_visible,
          :documents_enabled, :signature_status, :signature_requested_at,
          :signed_at, :tax_outcome_status, :tax_outcome_amount_cents,
          :tax_outcome_notes, fee_line_items: [:label, :amount_cents, :notes]
        ).tap do |permitted|
          permitted[:source] ||= "admin_created"
          permitted[:jurisdiction] ||= "both"
          permitted[:workflow_stage_id] ||= WorkflowStage.active.ordered.first&.id
          permitted[:fee_line_items] = sanitize_fee_line_items(permitted[:fee_line_items]) if permitted.key?(:fee_line_items)
        end
      end

      def create_client_for_return!
        attrs = submitted_client_attrs
        if attrs.blank?
          client = Client.new
          client.errors.add(:base, "Choose an existing client or enter new client details")
          raise ActiveRecord::RecordInvalid.new(client)
        end

        Client.create!(attrs)
      end

      def submitted_client_attrs
        attrs = tax_return_client_params.to_h.symbolize_keys
        return {} if attrs.blank?

        attrs[:client_type] = attrs[:client_type].presence || "individual"
        attrs[:has_tax_returns] = true
        attrs[:is_new_client] = true
        attrs[:notification_preference] = attrs[:email].present? ? "email" : "none"

        if attrs[:client_type] == "business"
          attrs[:first_name] = attrs[:first_name].presence || attrs[:business_name].presence || "Business"
          attrs[:last_name] = attrs[:last_name].presence || "Contact"
        end

        attrs.compact_blank
      end

      def sanitize_fee_line_items(items)
        Array(items).filter_map do |item|
          label = item[:label].to_s.strip
          amount_cents = item[:amount_cents].to_i
          notes = item[:notes].to_s.strip
          next if label.blank? && amount_cents.zero? && notes.blank?

          {
            label: label.presence || "Fee add-on",
            amount_cents: [amount_cents, 0].max,
            notes: notes
          }
        end
      end

      def log_return_created_event(tax_return)
        tax_return.workflow_events.create!(
          event_type: "return_created",
          new_value: tax_return.workflow_stage&.name,
          description: "Tax return created by staff",
          user: current_user
        )
      end

      def tax_return_summary(tr)
        {
          id: tr.id,
          tax_year: tr.tax_year,
          return_type: tr.return_type,
          form_type: tr.form_type,
          jurisdiction: tr.jurisdiction,
          source: tr.source,
          priority: tr.priority,
          payment_status: tr.payment_status,
          filing_status: tr.filing_status,
          portal_visible: tr.portal_visible,
          documents_enabled: tr.documents_enabled,
          signature_status: tr.signature_status,
          base_fee_cents: tr.base_fee_cents,
          discount_amount_cents: tr.discount_amount_cents,
          amount_paid_cents: tr.amount_paid_cents,
          fee_line_items: tr.fee_line_items,
          fee_line_items_total_cents: tr.fee_line_items_total_cents,
          final_fee_cents: tr.final_fee_cents,
          balance_due_cents: tr.balance_due_cents,
          tax_outcome_status: tr.tax_outcome_status,
          tax_outcome_amount_cents: tr.tax_outcome_amount_cents,
          tax_outcome_notes: tr.tax_outcome_notes,
          due_on: tr.due_on,
          client: {
            id: tr.client.id,
            full_name: tr.client.full_name,
            email: tr.client.email,
            phone: tr.client.phone,
            client_type: tr.client.client_type,
            business_name: tr.client.business_name,
            has_portal_access: tr.client.user&.portal_active? || false,
            portal_invite_pending: tr.client.user&.portal_invite_pending? || false
          },
          status: tr.workflow_stage&.name,
          status_slug: tr.workflow_stage&.slug,
          status_color: tr.workflow_stage&.color,
          assigned_to: tr.assigned_to ? {
            id: tr.assigned_to.id,
            name: tr.assigned_to.full_name
          } : nil,
          created_at: tr.created_at,
          updated_at: tr.updated_at
        }
      end

      def tax_return_detail(tr)
        {
          id: tr.id,
          tax_year: tr.tax_year,
          return_type: tr.return_type,
          form_type: tr.form_type,
          jurisdiction: tr.jurisdiction,
          source: tr.source,
          priority: tr.priority,
          notes: tr.notes,
          received_at: tr.received_at,
          due_on: tr.due_on,
          payment_status: tr.payment_status,
          base_fee_cents: tr.base_fee_cents,
          discount_amount_cents: tr.discount_amount_cents,
          discount_reason: tr.discount_reason,
          amount_paid_cents: tr.amount_paid_cents,
          fee_line_items: tr.fee_line_items,
          fee_line_items_total_cents: tr.fee_line_items_total_cents,
          final_fee_cents: tr.final_fee_cents,
          balance_due_cents: tr.balance_due_cents,
          paid_at: tr.paid_at,
          payment_notes: tr.payment_notes,
          filing_status: tr.filing_status,
          filed_at: tr.filed_at,
          drt_confirmation: tr.drt_confirmation,
          irs_confirmation: tr.irs_confirmation,
          tax_outcome_status: tr.tax_outcome_status,
          tax_outcome_amount_cents: tr.tax_outcome_amount_cents,
          tax_outcome_notes: tr.tax_outcome_notes,
          portal_visible: tr.portal_visible,
          documents_enabled: tr.documents_enabled,
          signature_status: tr.signature_status,
          signature_requested_at: tr.signature_requested_at,
          signed_at: tr.signed_at,
          completed_at: tr.completed_at,
          created_at: tr.created_at,
          updated_at: tr.updated_at,
          client: {
            id: tr.client.id,
            full_name: tr.client.full_name,
            email: tr.client.email,
            phone: tr.client.phone,
            filing_status: tr.client.filing_status,
            has_portal_access: tr.client.user&.portal_active? || false,
            portal_invite_pending: tr.client.user&.portal_invite_pending? || false
          },
          workflow_stage: tr.workflow_stage ? {
            id: tr.workflow_stage.id,
            name: tr.workflow_stage.name,
            slug: tr.workflow_stage.slug,
            color: tr.workflow_stage.color
          } : nil,
          assigned_to: tr.assigned_to ? {
            id: tr.assigned_to.id,
            name: tr.assigned_to.full_name,
            email: tr.assigned_to.email
          } : nil,
          reviewed_by: tr.reviewed_by ? {
            id: tr.reviewed_by.id,
            name: tr.reviewed_by.full_name
          } : nil,
          income_sources: tr.income_sources.map do |src|
            { id: src.id, source_type: src.source_type, payer_name: src.payer_name }
          end,
          documents: tr.documents.sort_by(&:created_at).reverse.map do |doc|
            {
              id: doc.id,
              filename: doc.filename,
              document_type: doc.document_type,
              content_type: doc.content_type,
              file_size: doc.file_size,
              uploaded_by: doc.uploaded_by ? {
                id: doc.uploaded_by.id,
                email: doc.uploaded_by.email,
                name: doc.uploaded_by.full_name,
                role: doc.uploaded_by.role
              } : nil,
              uploaded_by_source: doc.upload_source,
              uploaded_by_label: doc.upload_source_label,
              uploaded_by_name: doc.uploaded_by_display_name,
              created_at: doc.created_at,
              tax_return_id: doc.tax_return_id
            }
          end,
          workflow_events: tr.workflow_events.sort_by(&:created_at).reverse.map do |event|
            {
              id: event.id,
              event_type: event.event_type,
              old_value: event.old_value,
              new_value: event.new_value,
              description: event.description,
              actor: event.actor_name,
              created_at: event.created_at
            }
          end
        }
      end
    end
  end
end
