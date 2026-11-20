# frozen_string_literal: true

module Api
  module V1
    module Payroll
      class TimeSummariesController < ApplicationController
        include SharedSecretAuthenticatable

        before_action :authenticate_shared_secret!

        def show
          # The summary and the export that protects its entries are read
          # from one snapshot.
          report, export = TimeEntry.consistent_read do
            summary = ::Payroll::TimeSummaryBuilder.new(
              start_date: params[:start_date],
              end_date: params[:end_date]
            ).call
            [ summary, ReportExport.capture!(
              export_type: "payroll_time_summary",
              report: summary,
              protects_entries: true,
              deduplicate: true
            ) ]
          end
          report[:export] = {
            id: export.public_id,
            readiness_status: export.readiness_status,
            checksum: export.checksum
          }
          render json: report
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end
      end
    end
  end
end
