# frozen_string_literal: true

module Api
  module V1
    class TimeEntriesController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!
      before_action :set_time_entry, only: [ :show, :update, :destroy ]

      # GET /api/v1/time_entries
      def index
        @time_entries = current_user.admin? ? TimeEntry.all : TimeEntry.for_user(current_user)
        @time_entries = @time_entries.includes(:user, :client, :tax_return, :time_category, :service_type, :service_task, :linked_operation_task)

        # Filter by user (admin only)
        if params[:user_id].present? && current_user.admin?
          @time_entries = @time_entries.where(user_id: params[:user_id])
        end

        # Filter by date (with error handling for malformed dates)
        begin
          if params[:date].present?
            @time_entries = @time_entries.for_date(Date.parse(params[:date]))
          elsif params[:week].present?
            # Week starts on Sunday (frontend convention)
            week_start = Date.parse(params[:week])
            week_end = week_start + 6.days
            @time_entries = @time_entries.where(work_date: week_start..week_end)
          elsif params[:start_date].present? && params[:end_date].present?
            @time_entries = @time_entries.where(work_date: Date.parse(params[:start_date])..Date.parse(params[:end_date]))
          end
        rescue Date::Error, ArgumentError => e
          return render json: { error: "Invalid date format: #{e.message}" }, status: :bad_request
        end

        # Filter by category
        if params[:time_category_id].present?
          @time_entries = @time_entries.where(time_category_id: params[:time_category_id])
        end

        # Filter by client
        if params[:client_id].present?
          @time_entries = @time_entries.where(client_id: params[:client_id])
        end

        # Filter by service type
        if params[:service_type_id].present?
          @time_entries = @time_entries.where(service_type_id: params[:service_type_id])
        end

        @time_entries = @time_entries.order(work_date: :desc, created_at: :desc)

        # Pagination
        page = (params[:page] || 1).to_i
        # Allow up to 1000 for reports, default 50 for regular pagination
        per_page = (params[:per_page] || 50).to_i.clamp(1, 1000)
        total_count = @time_entries.count
        @time_entries = @time_entries.offset((page - 1) * per_page).limit(per_page)

        render json: {
          time_entries: @time_entries.map { |entry| serialize_time_entry(entry) },
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          },
          summary: calculate_summary(@time_entries)
        }
      end

      # GET /api/v1/time_entries/:id
      def show
        render json: { time_entry: serialize_time_entry(@time_entry) }
      end

      # POST /api/v1/time_entries
      def create
        @time_entry = current_user.time_entries.build(time_entry_params)

        if @time_entry.save
          sync_operation_task_link!(@time_entry)

          # Log the audit event
          AuditLog.log(
            auditable: @time_entry,
            action: "created",
            user: current_user,
            metadata: "#{@time_entry.hours}h on #{@time_entry.work_date}"
          )

          render json: { time_entry: serialize_time_entry(@time_entry) }, status: :created
        else
          render json: { error: @time_entry.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/time_entries/:id
      def update
        # Only allow editing own entries unless admin
        unless current_user.admin? || @time_entry.user_id == current_user.id
          return render json: { error: "You can only edit your own time entries" }, status: :forbidden
        end

        # Capture changes for audit log
        old_values = {
          hours: @time_entry.hours.to_f,
          work_date: @time_entry.work_date.iso8601,
          description: @time_entry.description,
          time_category_id: @time_entry.time_category_id
        }

        if @time_entry.update(time_entry_params)
          sync_operation_task_link!(@time_entry)

          # Log the audit event with changes
          new_values = {
            hours: @time_entry.hours.to_f,
            work_date: @time_entry.work_date.iso8601,
            description: @time_entry.description,
            time_category_id: @time_entry.time_category_id
          }

          changes = old_values.each_with_object({}) do |(key, old_val), hash|
            new_val = new_values[key]
            hash[key] = { from: old_val, to: new_val } if old_val != new_val
          end

          AuditLog.log(
            auditable: @time_entry,
            action: "updated",
            user: current_user,
            changes_made: changes.presence,
            metadata: "#{@time_entry.hours}h on #{@time_entry.work_date}"
          )

          render json: { time_entry: serialize_time_entry(@time_entry) }
        else
          render json: { error: @time_entry.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/time_entries/:id
      def destroy
        # Only allow deleting own entries unless admin
        unless current_user.admin? || @time_entry.user_id == current_user.id
          return render json: { error: "You can only delete your own time entries" }, status: :forbidden
        end

        # Capture info before deletion for audit log
        entry_info = "#{@time_entry.hours}h on #{@time_entry.work_date}"
        entry_id = @time_entry.id

        # Wrap in transaction so unlink + destroy are atomic
        ActiveRecord::Base.transaction do
          OperationTask.where(linked_time_entry_id: @time_entry.id).update_all(linked_time_entry_id: nil)
          @time_entry.destroy!
        end

        # Log the audit event (use entry_id since record is deleted)
        AuditLog.create!(
          auditable_type: "TimeEntry",
          auditable_id: entry_id,
          action: "deleted",
          user: current_user,
          metadata: entry_info
        )

        head :no_content
      end

      private

      def set_time_entry
        @time_entry = TimeEntry.includes(:linked_operation_task).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Time entry not found" }, status: :not_found
      end

      def time_entry_params
        params.require(:time_entry).permit(
          :work_date,
          :start_time,
          :end_time,
          :hours,
          :description,
          :time_category_id,
          :client_id,
          :tax_return_id,
          :break_minutes,
          :service_type_id,
          :service_task_id
        )
      end

      def serialize_time_entry(entry)
        {
          id: entry.id,
          work_date: entry.work_date.iso8601,
          start_time: entry.start_time&.strftime("%H:%M"),
          end_time: entry.end_time&.strftime("%H:%M"),
          formatted_start_time: entry.formatted_start_time,
          formatted_end_time: entry.formatted_end_time,
          hours: entry.hours.to_f,
          break_minutes: entry.break_minutes,
          description: entry.description,
          user: {
            id: entry.user.id,
            email: entry.user.email,
            display_name: entry.user.display_name,
            full_name: entry.user.full_name
          },
          time_category: entry.time_category ? {
            id: entry.time_category.id,
            name: entry.time_category.name
          } : nil,
          client: entry.client ? {
            id: entry.client.id,
            name: "#{entry.client.first_name} #{entry.client.last_name}"
          } : nil,
          tax_return: entry.tax_return ? {
            id: entry.tax_return.id,
            tax_year: entry.tax_return.tax_year
          } : nil,
          service_type: entry.service_type ? {
            id: entry.service_type.id,
            name: entry.service_type.name,
            color: entry.service_type.color
          } : nil,
          service_task: entry.service_task ? {
            id: entry.service_task.id,
            name: entry.service_task.name
          } : nil,
          linked_operation_task: entry.linked_operation_task ? {
            id: entry.linked_operation_task.id,
            title: entry.linked_operation_task.title
          } : nil,
          created_at: entry.created_at.iso8601,
          updated_at: entry.updated_at.iso8601
        }
      end

      def sync_operation_task_link!(time_entry)
        operation_task_id = params[:operation_task_id].presence
        return if operation_task_id.blank?

        task = OperationTask.find_by(id: operation_task_id)
        return unless task

        # Keep linkage within the same client when both are present.
        if task.client_id.present? && time_entry.client_id.present? && task.client_id != time_entry.client_id
          return
        end

        # Wrap in transaction with row locking to prevent race conditions
        ActiveRecord::Base.transaction do
          old_task = OperationTask.lock.find_by(linked_time_entry_id: time_entry.id)
          old_task.update!(linked_time_entry_id: nil) if old_task && old_task.id != task.id
          task.lock!
          task.update!(linked_time_entry_id: time_entry.id)
        end
      rescue ActiveRecord::RecordNotUnique
        # Another task is already linked to this time entry (unique index violation)
        # This is a race condition - silently ignore as the link already exists
        Rails.logger.warn("Unique constraint violation linking task #{task.id} to time_entry #{time_entry.id}")
      end

      def calculate_summary(entries)
        total_break_minutes = entries.sum(:break_minutes).to_i
        {
          total_hours: entries.sum(:hours).to_f,
          total_break_hours: (total_break_minutes / 60.0).round(2),
          entry_count: entries.count
        }
      end
    end
  end
end
