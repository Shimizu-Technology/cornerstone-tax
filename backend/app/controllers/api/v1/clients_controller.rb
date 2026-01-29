# frozen_string_literal: true

module Api
  module V1
    class ClientsController < BaseController
      # Require authentication for all actions except intake endpoints
      before_action :authenticate_user!, except: []
      before_action :require_staff!, except: []

      # GET /api/v1/clients
      def index
        clients = Client.includes(:tax_returns, tax_returns: [:workflow_stage, :assigned_to])
                        .order(created_at: :desc)

        # Search
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          clients = clients.where(
            "LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ?",
            search_term, search_term, search_term
          )
        end

        # Filter by workflow stage
        if params[:stage].present?
          clients = clients.joins(tax_returns: :workflow_stage)
                           .where(workflow_stages: { slug: params[:stage] })
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i.clamp(1, 100)
        total_count = clients.count
        clients = clients.offset((page - 1) * per_page).limit(per_page)

        render json: {
          clients: clients.map { |client| client_summary(client) },
          meta: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/clients/:id
      def show
        client = Client.includes(
          :dependents,
          tax_returns: [:workflow_stage, :income_sources, :workflow_events, :assigned_to]
        ).find(params[:id])

        render json: { client: client_detail(client) }
      end

      # POST /api/v1/clients (Quick Create)
      def create
        client = Client.new(quick_create_client_params)

        ActiveRecord::Base.transaction do
          if client.save
            # Always create a tax return for quick create
            initial_stage = WorkflowStage.find_by(slug: "intake_received") ||
                            WorkflowStage.active.ordered.first
            tax_year = (params.dig(:client, :tax_year) || Date.current.year).to_i
            
            tax_return = client.tax_returns.create!(
              tax_year: tax_year,
              workflow_stage: initial_stage
            )

            # Log workflow event
            tax_return.workflow_events.create!(
              event_type: "status_change",
              new_value: initial_stage&.name,
              description: "Client created via quick create"
            )

            render json: { 
              message: "Client created successfully",
              client: client_summary(client.reload) 
            }, status: :created
          else
            render json: { errors: client.errors.full_messages }, status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: [e.message] }, status: :unprocessable_entity
      end

      # PATCH /api/v1/clients/:id
      def update
        client = Client.find(params[:id])

        # Safe attributes to track for audit (excludes encrypted bank fields)
        safe_audit_attrs = %w[
          first_name last_name date_of_birth email phone mailing_address
          filing_status is_new_client has_prior_year_return changes_from_prior_year
          spouse_name spouse_dob denied_eic_actc denied_eic_actc_year
          has_crypto_transactions wants_direct_deposit
        ]

        # Get only the safe attributes that are being updated
        attrs_to_track = client_params.keys.map(&:to_s) & safe_audit_attrs
        
        # Capture old values before update (only safe attributes)
        old_values = {}
        attrs_to_track.each do |attr|
          old_values[attr] = client.send(attr) rescue nil
        end

        if client.update(client_params)
          # Calculate what actually changed
          changes = {}
          attrs_to_track.each do |attr|
            old_val = old_values[attr]
            new_val = client.send(attr) rescue nil
            changes[attr] = { from: old_val, to: new_val } if old_val != new_val
          end

          # Log audit event if there were changes
          if changes.any?
            AuditLog.log(
              auditable: client,
              action: "updated",
              user: current_user,
              changes_made: changes,
              metadata: "Updated #{changes.keys.join(', ')}"
            )
          end

          render json: { client: client_detail(client) }
        else
          render json: { errors: client.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def client_params
        params.require(:client).permit(
          :first_name, :last_name, :date_of_birth, :email, :phone, :mailing_address,
          :filing_status, :is_new_client, :has_prior_year_return, :changes_from_prior_year,
          :spouse_name, :spouse_dob, :denied_eic_actc, :denied_eic_actc_year,
          :has_crypto_transactions, :wants_direct_deposit, :bank_routing_number,
          :bank_account_number, :bank_account_type
        )
      end

      def quick_create_client_params
        params.require(:client).permit(
          :first_name, :last_name, :date_of_birth, :email, :phone,
          :filing_status, :is_new_client
        ).tap do |p|
          # Set defaults for quick create
          p[:is_new_client] = true if p[:is_new_client].nil?
        end
      end

      def client_summary(client)
        latest_return = client.tax_returns.max_by(&:created_at)

        {
          id: client.id,
          first_name: client.first_name,
          last_name: client.last_name,
          full_name: client.full_name,
          email: client.email,
          phone: client.phone,
          is_new_client: client.is_new_client,
          created_at: client.created_at,
          tax_return: latest_return ? {
            id: latest_return.id,
            tax_year: latest_return.tax_year,
            status: latest_return.workflow_stage&.name,
            status_slug: latest_return.workflow_stage&.slug,
            status_color: latest_return.workflow_stage&.color,
            assigned_to: latest_return.assigned_to&.full_name
          } : nil
        }
      end

      def client_detail(client)
        {
          id: client.id,
          first_name: client.first_name,
          last_name: client.last_name,
          full_name: client.full_name,
          date_of_birth: client.date_of_birth,
          email: client.email,
          phone: client.phone,
          mailing_address: client.mailing_address,
          filing_status: client.filing_status,
          is_new_client: client.is_new_client,
          has_prior_year_return: client.has_prior_year_return,
          changes_from_prior_year: client.changes_from_prior_year,
          spouse_name: client.spouse_name,
          spouse_dob: client.spouse_dob,
          denied_eic_actc: client.denied_eic_actc,
          denied_eic_actc_year: client.denied_eic_actc_year,
          has_crypto_transactions: client.has_crypto_transactions,
          wants_direct_deposit: client.wants_direct_deposit,
          created_at: client.created_at,
          updated_at: client.updated_at,
          dependents: client.dependents.map do |dep|
            {
              id: dep.id,
              name: dep.name,
              date_of_birth: dep.date_of_birth,
              relationship: dep.relationship,
              months_lived_with_client: dep.months_lived_with_client,
              is_student: dep.is_student,
              is_disabled: dep.is_disabled
            }
          end,
          tax_returns: client.tax_returns.order(created_at: :desc).map do |tr|
            {
              id: tr.id,
              tax_year: tr.tax_year,
              notes: tr.notes,
              status: tr.workflow_stage&.name,
              status_slug: tr.workflow_stage&.slug,
              status_color: tr.workflow_stage&.color,
              assigned_to: tr.assigned_to ? {
                id: tr.assigned_to.id,
                name: tr.assigned_to.full_name
              } : nil,
              created_at: tr.created_at,
              income_sources: tr.income_sources.map do |src|
                { id: src.id, source_type: src.source_type, payer_name: src.payer_name }
              end,
              workflow_events: tr.workflow_events.recent.limit(10).map do |event|
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
        }
      end
    end
  end
end
