# frozen_string_literal: true

module Api
  module V1
    class PayrollIngestController < ApplicationController
      include SharedSecretAuthenticatable

      before_action :authenticate_shared_secret!

      # POST /api/v1/payroll/ingest
      #
      # Idempotent endpoint: re-posting with the same idempotency_key returns
      # the existing batch without modification.
      def create
        existing = PayrollImportBatch.find_by(idempotency_key: ingest_params[:idempotency_key])

        if existing
          render json: { payroll_import_batch: serialize(existing), replayed: true }, status: :ok
          return
        end

        batch = PayrollImportBatch.new(
          idempotency_key: ingest_params[:idempotency_key],
          source_payroll_run_id: ingest_params[:source_payroll_run_id],
          payload: ingest_params[:payload],
          total_gross: ingest_params[:total_gross],
          total_net: ingest_params[:total_net],
          total_tax: ingest_params[:total_tax],
          employee_count: ingest_params[:employee_count],
          status: "pending"
        )

        unless batch.valid?
          render json: { error: "Validation failed", errors: batch.errors.full_messages }, status: :unprocessable_entity
          return
        end

        reconcile(batch)

        batch.save!
        render json: { payroll_import_batch: serialize(batch), replayed: false }, status: :created
      end

      private

      def ingest_params
        params.require(:payroll_import).permit(
          :idempotency_key,
          :source_payroll_run_id,
          :total_gross,
          :total_net,
          :total_tax,
          :employee_count,
          payload: {}
        )
      end

      def reconcile(batch)
        provided_totals = {
          total_gross: batch.total_gross,
          total_net: batch.total_net,
          total_tax: batch.total_tax,
          employee_count: batch.employee_count
        }.compact

        if provided_totals.empty?
          batch.status = "reconciled"
          batch.reconciliation_details = { skipped: true, reason: "No totals provided" }
          return
        end

        result = PayrollReconciliationService.new(
          payload: batch.payload,
          provided_totals: provided_totals
        ).call

        if result.match?
          batch.status = "reconciled"
        else
          batch.status = "failed"
          batch.error_message = "Reconciliation mismatch"
        end
        batch.reconciliation_details = result.details
      end

      def serialize(batch)
        {
          id: batch.id,
          idempotency_key: batch.idempotency_key,
          source_payroll_run_id: batch.source_payroll_run_id,
          status: batch.status,
          total_gross: batch.total_gross&.to_f,
          total_net: batch.total_net&.to_f,
          total_tax: batch.total_tax&.to_f,
          employee_count: batch.employee_count,
          error_message: batch.error_message,
          reconciliation_details: batch.reconciliation_details,
          created_at: batch.created_at,
          updated_at: batch.updated_at
        }
      end
    end
  end
end
