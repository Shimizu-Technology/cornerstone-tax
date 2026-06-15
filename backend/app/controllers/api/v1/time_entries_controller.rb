# frozen_string_literal: true

module Api
  module V1
    class TimeEntriesController < BaseController
      PENDING_APPROVAL_SORTS = %w[work_date created_at employee hours approval_type category client service].freeze
      PENDING_APPROVAL_DIRECTIONS = %w[asc desc].freeze
      PENDING_APPROVAL_TYPES = %w[time_entry overtime both].freeze

      before_action :authenticate_user!
      before_action :require_staff!
      before_action :set_time_entry, only: [ :show, :update, :destroy, :approve, :deny, :approve_overtime, :deny_overtime ]
      before_action :require_time_entry_owner_or_admin!, only: [ :update, :destroy ]
      before_action :require_admin!, only: [ :approve, :deny, :approve_overtime, :deny_overtime, :bulk_approve ]

      # GET /api/v1/time_entries
      def index
        @time_entries = current_user.admin? ? TimeEntry.all : TimeEntry.for_user(current_user)
        @time_entries = @time_entries.includes(:user, :client, :tax_return, :time_category, :schedule, :approved_by,
                                               :overtime_approved_by, :time_entry_breaks, :service_type, :service_task,
                                               :linked_operation_tasks)

        if params[:user_id].present? && current_user.admin?
          @time_entries = @time_entries.where(user_id: params[:user_id])
        end

        if params[:date].present?
          @time_entries = @time_entries.for_date(Date.parse(params[:date]))
        elsif params[:week].present?
          week_start = Date.parse(params[:week])
          week_end = week_start + 6.days
          @time_entries = @time_entries.where(work_date: week_start..week_end)
        elsif params[:start_date].present? && params[:end_date].present?
          @time_entries = @time_entries.where(work_date: Date.parse(params[:start_date])..Date.parse(params[:end_date]))
        end

        @time_entries = @time_entries.where(time_category_id: params[:time_category_id]) if params[:time_category_id].present?
        @time_entries = @time_entries.where(client_id: params[:client_id]) if params[:client_id].present?
        @time_entries = @time_entries.where(service_type_id: params[:service_type_id]) if params[:service_type_id].present?
        @time_entries = @time_entries.where(service_task_id: params[:service_task_id]) if params[:service_task_id].present?
        @time_entries = @time_entries.where(entry_method: params[:entry_method]) if params[:entry_method].present?

        if params[:approval_status].present?
          @time_entries = @time_entries.where(approval_status: approval_status_value(params[:approval_status]))
        end

        if params[:overtime_status].present?
          @time_entries = @time_entries.where(overtime_status: params[:overtime_status])
        end

        if params[:exclude_approval_statuses].present?
          statuses = Array(params[:exclude_approval_statuses])
          @time_entries = @time_entries.where("approval_status IS NULL OR approval_status NOT IN (?)", statuses)
        end

        @time_entries = @time_entries.order(work_date: :desc, created_at: :desc)

        summary = calculate_summary(@time_entries)

        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 500)
        total_count = summary[:entry_count]
        @time_entries = @time_entries.offset((page - 1) * per_page).limit(per_page)

        render json: {
          time_entries: @time_entries.map { |entry| serialize_time_entry(entry) },
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil,
            truncated: total_count > page * per_page
          },
          summary: summary
        }
      end

      # GET /api/v1/time_entries/:id
      def show
        unless current_user.admin? || @time_entry.user_id == current_user.id
          return render json: { error: "Time entry not found" }, status: :not_found
        end

        render json: { time_entry: serialize_time_entry(@time_entry) }
      end

      # POST /api/v1/time_entries
      def create
        if period_locked_for_date?(time_entry_params[:work_date])
          return render json: { error: "This time period is locked and cannot be modified" }, status: :forbidden
        end

        entry_owner = resolve_entry_owner
        return unless entry_owner

        @time_entry = entry_owner.time_entries.build(time_entry_params.except(:user_id, :breaks))
        @time_entry.entry_method = "manual"

        if current_user.admin?
          @time_entry.admin_override = true if entry_owner.id != current_user.id
          @time_entry.approval_status = "approved"
        else
          @time_entry.approval_status = "pending"
        end

        if @time_entry.save
          AuditLog.log(
            auditable: @time_entry,
            action: "created",
            user: current_user,
            metadata: "#{@time_entry.hours}h on #{@time_entry.work_date} (manual, #{@time_entry.approval_status})"
          )

          render json: { time_entry: serialize_time_entry(@time_entry) }, status: :created
        else
          render json: { error: @time_entry.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/time_entries/:id
      def update
        target_work_date = time_entry_params[:work_date].presence || @time_entry.work_date
        if period_locked_for_date?(target_work_date) || period_locked_for_date?(@time_entry.work_date)
          return render json: { error: "This time period is locked and cannot be modified" }, status: :forbidden
        end

        unless @time_entry.editable_by?(current_user)
          message = @time_entry.locked? ? "This time entry is locked and cannot be edited" : "You can only edit your own time entries"
          return render json: { error: message }, status: :forbidden
        end

        old_values = {
          hours: @time_entry.hours.to_f,
          work_date: @time_entry.work_date.iso8601,
          description: @time_entry.description,
          time_category_id: @time_entry.time_category_id,
          client_id: @time_entry.client_id,
          service_type_id: @time_entry.service_type_id,
          service_task_id: @time_entry.service_task_id,
          overtime_status: @time_entry.overtime_status,
          start_time: @time_entry.formatted_start_time,
          end_time: @time_entry.formatted_end_time
        }

        update_params = time_entry_params.except(:user_id, :breaks).to_h.symbolize_keys
        raw_clock_params = raw_time_entry_params.slice(:work_date, :start_time, :end_time)
        normalize_clock_entry_time_update(@time_entry, update_params, raw_clock_params)
        return if performed?

        break_update = build_break_update(@time_entry, update_params)
        return if performed?
        update_params[:break_minutes] = break_update[:total_minutes] if break_update

        if !current_user.admin? && @time_entry.status == "completed"
          update_params[:approval_status] = "pending"
          update_params[:approved_by_id] = nil
          update_params[:approved_at] = nil
          update_params[:approval_note] = append_review_note(@time_entry.approval_note)
        end

        saved = false
        break_replace_error = nil
        @time_entry.transaction do
          saved = @time_entry.update(update_params)
          if saved && break_update
            break_replace_error = replace_break_records(@time_entry, break_update[:breaks])
            raise ActiveRecord::Rollback if break_replace_error
          end
          raise ActiveRecord::Rollback unless saved
        end

        if break_replace_error
          render json: { error: break_replace_error }, status: :unprocessable_entity
        elsif saved
          if @time_entry.status == "completed" &&
             (old_values[:hours] != @time_entry.hours.to_f || old_values[:work_date] != @time_entry.work_date.iso8601)
            new_overtime = TimeClockService.check_overtime_status(@time_entry.user, @time_entry, include_entry_hours: false)
            overtime_attrs = { overtime_status: new_overtime }

            if !current_user.admin? || old_values[:overtime_status].in?([ "approved", "denied" ])
              overtime_attrs[:overtime_approved_by_id] = nil
              overtime_attrs[:overtime_approved_at] = nil
              overtime_attrs[:overtime_note] = nil
            end

            @time_entry.update!(overtime_attrs)
          end

          new_values = {
            hours: @time_entry.hours.to_f,
            work_date: @time_entry.work_date.iso8601,
            description: @time_entry.description,
            time_category_id: @time_entry.time_category_id,
            client_id: @time_entry.client_id,
            service_type_id: @time_entry.service_type_id,
            service_task_id: @time_entry.service_task_id,
            overtime_status: @time_entry.overtime_status,
            start_time: @time_entry.formatted_start_time,
            end_time: @time_entry.formatted_end_time
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

          render json: { time_entry: serialize_time_entry(eager_reload(@time_entry)) }
        else
          render json: { error: @time_entry.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/time_entries/:id
      def destroy
        if period_locked_for_date?(@time_entry.work_date)
          return render json: { error: "This time period is locked and cannot be modified" }, status: :forbidden
        end

        unless @time_entry.deletable_by?(current_user)
          message = @time_entry.locked? ? "This time entry is locked and cannot be deleted" : "You can only delete your own time entries"
          return render json: { error: message }, status: :forbidden
        end

        entry_info = "#{@time_entry.hours}h on #{@time_entry.work_date}"
        entry_id = @time_entry.id

        @time_entry.destroy

        AuditLog.create!(
          auditable_type: "TimeEntry",
          auditable_id: entry_id,
          action: "deleted",
          user: current_user,
          metadata: entry_info
        )

        head :no_content
      end

      # ── Clock Actions ──

      # POST /api/v1/time_entries/clock_in
      def clock_in
        if current_user.admin? && params[:user_id].present?
          admin_override = current_user
          target_user = User.staff.find(params[:user_id])
        elsif current_user.admin? && params[:admin_override].present?
          admin_override = current_user
          target_user = current_user
        else
          admin_override = nil
          target_user = current_user
        end

        entry = TimeClockService.clock_in(user: target_user, admin_override_by: admin_override)
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }, status: :created
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/clock_out
      def clock_out
        target_user = resolve_clock_target_user
        admin_override = (current_user.admin? && target_user.id != current_user.id) ? current_user : nil
        permitted = params.permit(:corrected_end_time, :description)
        entry = TimeClockService.clock_out(
          user: target_user,
          admin_override_by: admin_override,
          corrected_end_time: permitted[:corrected_end_time],
          description: permitted[:description]
        )
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/start_break
      def start_break
        target_user = resolve_clock_target_user
        admin_override = (current_user.admin? && target_user.id != current_user.id) ? current_user : nil
        entry = TimeClockService.start_break(user: target_user, admin_override_by: admin_override)
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/end_break
      def end_break
        target_user = resolve_clock_target_user
        admin_override = (current_user.admin? && target_user.id != current_user.id) ? current_user : nil
        entry = TimeClockService.end_break(user: target_user, admin_override_by: admin_override)
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/time_entries/current_status
      def current_status
        status = TimeClockService.current_status(user: current_user)
        status[:is_admin] = current_user.admin?
        render json: status
      end

      # ── Approval Actions ──

      # GET /api/v1/time_entries/pending_approvals
      def pending_approvals
        return render json: { error: "Admin access required" }, status: :forbidden unless current_user.admin?

        filters = pending_approval_filter_params
        return if performed?

        filtered_entries = apply_pending_approval_filters(pending_approval_entries_scope, filters)
        sorted_entries = apply_pending_approval_sort(filtered_entries, filters[:sort], filters[:direction])

        page = [ (params[:page] || 1).to_i, 1 ].max
        per_page = (params[:per_page] || 250).to_i.clamp(1, 500)
        summary = pending_approvals_summary(filtered_entries)
        total_count = summary[:entry_count]
        entries = sorted_entries.offset((page - 1) * per_page).limit(per_page)

        render json: {
          pending_entries: entries.map { |entry| serialize_time_entry(entry) },
          count: total_count,
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil,
            truncated: total_count > page * per_page
          },
          summary: summary,
          filters: serialize_pending_approval_filters(filters),
          sort: {
            field: filters[:sort],
            direction: filters[:direction]
          }
        }
      end

      # POST /api/v1/time_entries/:id/approve
      def approve
        entry = TimeClockService.approve_entry(entry: @time_entry, approved_by: current_user, note: params[:note])
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::AuthorizationError => e
        render json: { error: e.message }, status: :forbidden
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/:id/deny
      def deny
        entry = TimeClockService.deny_entry(entry: @time_entry, denied_by: current_user, note: params[:note])
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::AuthorizationError => e
        render json: { error: e.message }, status: :forbidden
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/:id/approve_overtime
      def approve_overtime
        entry = TimeClockService.approve_overtime(entry: @time_entry, approved_by: current_user, note: params[:note])
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::AuthorizationError => e
        render json: { error: e.message }, status: :forbidden
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/:id/deny_overtime
      def deny_overtime
        entry = TimeClockService.deny_overtime(entry: @time_entry, denied_by: current_user, note: params[:note])
        render json: { time_entry: serialize_time_entry(eager_reload(entry)) }
      rescue TimeClockService::AuthorizationError => e
        render json: { error: e.message }, status: :forbidden
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/time_entries/bulk_approve
      def bulk_approve
        entry_ids = Array(params[:entry_ids]).filter_map do |value|
          integer_id = value.to_i
          integer_id if integer_id.positive?
        end.uniq

        if entry_ids.empty?
          return render json: { error: "Select at least one pending entry to approve" }, status: :unprocessable_entity
        end

        if entry_ids.length > 100
          return render json: { error: "Approve at most 100 entries at a time" }, status: :unprocessable_entity
        end

        note = params[:note].presence

        updated_entry_ids = []
        error_message = nil
        ActiveRecord::Base.transaction do
          entries_by_id = TimeEntry.where(id: entry_ids).lock.index_by(&:id)
          missing_ids = entry_ids - entries_by_id.keys
          if missing_ids.any?
            error_message = "One or more selected entries could not be found"
            raise ActiveRecord::Rollback
          end

          overtime_context = build_bulk_overtime_context(entries_by_id.values)

          entry_ids.each do |entry_id|
            entry = entries_by_id.fetch(entry_id)
            unless entry.approval_status == "pending" || entry.overtime_status == "pending"
              error_message = "One or more selected entries are no longer pending approval"
              raise ActiveRecord::Rollback
            end

            approve_bulk_time_entry!(entry, note, overtime_context) if entry.approval_status == "pending"
            approve_bulk_overtime!(entry, note) if entry.overtime_status == "pending"

            updated_entry_ids << entry.id
          end
        end

        if error_message
          return render json: { error: error_message }, status: :unprocessable_entity
        end

        updated_entries = eager_load_time_entries(updated_entry_ids)

        render json: {
          time_entries: updated_entries.map { |entry| serialize_time_entry(entry) },
          count: updated_entries.length
        }
      rescue TimeClockService::AuthorizationError => e
        render json: { error: e.message }, status: :forbidden
      rescue TimeClockService::ClockError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/time_entries/whos_working
      def whos_working
        return render json: { error: "Admin access required" }, status: :forbidden unless current_user.admin?

        render json: { workers: WhosWorkingQuery.call }
      end

      private

      def eager_reload(entry)
        time_entry_serializer_scope.find(entry.id)
      end

      def eager_load_time_entries(entry_ids)
        entries_by_id = time_entry_serializer_scope.where(id: entry_ids).index_by(&:id)
        entry_ids.filter_map { |entry_id| entries_by_id[entry_id] }
      end

      def time_entry_serializer_scope
        TimeEntry.includes(:user, :client, :tax_return, :time_category, :schedule, :approved_by,
                          :overtime_approved_by, :time_entry_breaks, :service_type, :service_task,
                          :linked_operation_tasks)
      end

      def approve_bulk_time_entry!(entry, note, overtime_context)
        overtime_check_required = bulk_overtime_check_required?(entry)
        attrs = {
          approval_status: "approved",
          approved_by: current_user,
          approved_at: Time.current,
          approval_note: combine_approval_note(entry.approval_note, note)
        }

        attrs[:overtime_status] = projected_overtime_status(entry, overtime_context) if overtime_check_required

        entry.update!(attrs)
        add_entry_to_bulk_overtime_context(entry, overtime_context) if overtime_check_required
      end

      def approve_bulk_overtime!(entry, note)
        entry.update!(
          overtime_status: "approved",
          overtime_approved_by: current_user,
          overtime_approved_at: Time.current,
          overtime_note: note
        )
      end

      def build_bulk_overtime_context(entries)
        entries_requiring_check = entries.select { |entry| bulk_overtime_check_required?(entry) }
        daily_hours = Hash.new(0.0)
        weekly_hours = Hash.new(0.0)

        if entries_requiring_check.any?
          user_ids = entries_requiring_check.map(&:user_id).compact.uniq
          dates = entries_requiring_check.map(&:work_date).uniq
          week_start = dates.min.beginning_of_week(:sunday)
          week_end = dates.max.end_of_week(:sunday)

          TimeEntry.countable.where(user_id: user_ids, work_date: dates).group(:user_id, :work_date).sum(:hours).each do |(user_id, work_date), hours|
            daily_hours[[ user_id, work_date ]] = hours.to_f
          end

          TimeEntry.countable.where(user_id: user_ids, work_date: week_start..week_end).pluck(:user_id, :work_date, :hours).each do |user_id, work_date, hours|
            weekly_hours[[ user_id, work_date.beginning_of_week(:sunday) ]] += hours.to_f
          end
        end

        {
          daily_hours: daily_hours,
          weekly_hours: weekly_hours,
          daily_threshold: (Setting.get("overtime_daily_threshold_hours") || "8").to_f,
          weekly_threshold: (Setting.get("overtime_weekly_threshold_hours") || "40").to_f
        }
      end

      def bulk_overtime_check_required?(entry)
        entry.status == "completed" && entry.overtime_status.in?([ nil, "none" ])
      end

      def projected_overtime_status(entry, overtime_context)
        daily_hours = overtime_context[:daily_hours][[ entry.user_id, entry.work_date ]] + entry.hours.to_f
        weekly_hours = overtime_context[:weekly_hours][[ entry.user_id, entry.work_date.beginning_of_week(:sunday) ]] + entry.hours.to_f

        daily_hours > overtime_context[:daily_threshold] || weekly_hours > overtime_context[:weekly_threshold] ? "pending" : "none"
      end

      def add_entry_to_bulk_overtime_context(entry, overtime_context)
        overtime_context[:daily_hours][[ entry.user_id, entry.work_date ]] += entry.hours.to_f
        overtime_context[:weekly_hours][[ entry.user_id, entry.work_date.beginning_of_week(:sunday) ]] += entry.hours.to_f
      end

      def combine_approval_note(existing_note, new_note)
        [ existing_note.presence, new_note.presence ]
          .compact
          .flat_map { |note_part| note_part.split(" | ").map(&:strip) }
          .reject(&:blank?)
          .uniq
          .join(" | ")
          .presence
      end

      def resolve_clock_target_user
        if current_user.admin? && params[:user_id].present?
          User.staff.find(params[:user_id])
        else
          current_user
        end
      end

      def set_time_entry
        @time_entry = time_entry_serializer_scope.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Time entry not found" }, status: :not_found
      end

      def require_time_entry_owner_or_admin!
        return if current_user.admin? || @time_entry.user_id == current_user.id

        action = action_name == "destroy" ? "delete" : "edit"
        render json: { error: "You can only #{action} your own time entries" }, status: :forbidden
      end

      def time_entry_params
        permitted = params.require(:time_entry).permit(
          :work_date,
          :start_time,
          :end_time,
          :hours,
          :description,
          :time_category_id,
          :client_id,
          :tax_return_id,
          :break_minutes,
          :user_id,
          :service_type_id,
          :service_task_id,
          breaks: [ :id, :start_time, :end_time, :_destroy ]
        )
        normalize_manual_time(permitted, :start_time)
        normalize_manual_time(permitted, :end_time)
        permitted
      end

      def normalize_manual_time(params_hash, field)
        val = params_hash[field]
        return unless val.present? && val.is_a?(String) && val.match?(/\A\d{1,2}:\d{2}\z/)

        h, m = val.split(":").map(&:to_i)
        return unless h.between?(0, 23) && m.between?(0, 59)

        tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
        params_hash[field] = tz.local(2000, 1, 1, h, m, 0)
      end

      def normalize_clock_entry_time_update(entry, params_hash, raw_params = {})
        return unless entry.clock_entry?

        target_work_date = raw_params[:work_date].presence || params_hash[:work_date].presence || entry.work_date
        start_value = raw_params[:start_time].presence || params_hash[:start_time]
        corrected_start = time_on_work_date(start_value, Date.parse(target_work_date.to_s)) if start_value.present?

        if corrected_start
          if entry.active? && corrected_start > Time.current
            return render json: { error: "Clock-in time cannot be in the future for an active entry" }, status: :unprocessable_entity
          end

          first_break = entry.time_entry_breaks.order(:start_time).first
          if first_break && corrected_start >= first_break.start_time
            return render json: { error: "Clock-in time must be before the first break" }, status: :unprocessable_entity
          end

          params_hash[:start_time] = corrected_start
          params_hash[:clock_in_at] = corrected_start
        end

        if entry.active?
          params_hash.delete(:end_time)
          params_hash.delete(:hours)
        else
          end_value = raw_params[:end_time].presence || params_hash[:end_time]
          return unless end_value.present?

          start_reference = corrected_start || entry.start_time
          corrected_end = time_on_work_date(end_value, Date.parse(target_work_date.to_s), after: start_reference)

          if corrected_end > Time.current
            return render json: { error: "Clock-out time cannot be in the future" }, status: :unprocessable_entity
          end

          params_hash[:end_time] = corrected_end
          params_hash[:clock_out_at] = corrected_end
        end
      rescue Date::Error, ArgumentError
        render json: { error: "Clock times are invalid" }, status: :unprocessable_entity
      end

      def raw_time_entry_params
        params.require(:time_entry).permit(:work_date, :start_time, :end_time).to_h.symbolize_keys
      end

      def build_break_update(entry, update_params)
        raw_breaks = params.require(:time_entry)[:breaks]
        return nil if raw_breaks.nil?

        raw_break_rows = Array(raw_breaks).filter { |raw_break| raw_break.respond_to?(:to_h) || raw_break.respond_to?(:to_unsafe_h) }
        return nil if raw_break_rows.empty? && !entry.time_entry_breaks.exists?

        if entry.active?
          render json: { error: "Break details can only be corrected after clock-out" }, status: :unprocessable_entity
          return nil
        end

        work_date = Date.parse((update_params[:work_date].presence || entry.work_date).to_s)
        start_boundary = time_on_work_date(update_params[:start_time].presence || entry.start_time, work_date)
        end_boundary = time_on_work_date(update_params[:end_time].presence || entry.end_time, work_date, after: start_boundary)

        normalized = raw_break_rows.filter_map do |raw_break|
          raw_break = raw_break.respond_to?(:to_unsafe_h) ? raw_break.to_unsafe_h : raw_break.to_h
          next if ActiveModel::Type::Boolean.new.cast(raw_break[:_destroy] || raw_break["_destroy"])

          start_value = raw_break[:start_time] || raw_break["start_time"]
          end_value = raw_break[:end_time] || raw_break["end_time"]
          next if start_value.blank? && end_value.blank?

          if start_value.blank? || end_value.blank?
            render json: { error: "Each break needs both a start and end time" }, status: :unprocessable_entity
            return nil
          end

          break_start = time_on_work_date(start_value, work_date, after: start_boundary - 1.second)
          break_end = time_on_work_date(end_value, work_date, after: break_start)

          if break_start < start_boundary || break_end > end_boundary
            render json: { error: "Breaks must fall within the entry start and end time" }, status: :unprocessable_entity
            return nil
          end

          { start_time: break_start, end_time: break_end, duration_minutes: ((break_end - break_start) / 60).round }
        end

        sorted = normalized.sort_by { |row| row[:start_time] }
        sorted.each_cons(2) do |left, right|
          if left[:end_time] > right[:start_time]
            render json: { error: "Breaks cannot overlap" }, status: :unprocessable_entity
            return nil
          end
        end

        { breaks: sorted, total_minutes: sorted.sum { |row| row[:duration_minutes].to_i } }
      rescue Date::Error, ArgumentError
        render json: { error: "Break times are invalid" }, status: :unprocessable_entity
        nil
      end

      def time_on_work_date(value, work_date, after: nil)
        if value.respond_to?(:in_time_zone) && !value.is_a?(String)
          local = value.in_time_zone(TimeClockService::BUSINESS_TIMEZONE)
          hour = local.hour
          minute = local.min
        else
          match = value.to_s.match(/\A(\d{1,2}):(\d{2})\z/)
          raise ArgumentError, "Invalid time" unless match

          hour = match[1].to_i
          minute = match[2].to_i
          raise ArgumentError, "Invalid time" unless hour.between?(0, 23) && minute.between?(0, 59)
        end

        tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
        resolved = tz.local(work_date.year, work_date.month, work_date.day, hour, minute, 0)
        resolved += 1.day if after.present? && resolved <= after
        resolved
      end

      def replace_break_records(entry, break_rows)
        entry.time_entry_breaks.destroy_all
        break_rows.each do |row|
          entry_break = entry.time_entry_breaks.create(row)
          return entry_break.errors.full_messages.to_sentence unless entry_break.persisted?
        end
        nil
      end

      def resolve_entry_owner
        requested_user_id = time_entry_params[:user_id]
        return current_user if requested_user_id.blank?

        unless current_user.admin?
          render json: { error: "Only admins can create entries for other users" }, status: :forbidden
          return nil
        end

        user = User.staff.find_by(id: requested_user_id)
        unless user
          render json: { error: "Selected user is invalid" }, status: :unprocessable_entity
          return nil
        end

        user
      end

      def period_locked_for_date?(date)
        return false if date.blank?

        TimePeriodLock.locked_for_date?(Date.parse(date.to_s))
      rescue Date::Error
        false
      end

      def serialize_time_entry(entry)
        tz = TimeClockService::BUSINESS_TIMEZONE
        entry_user = entry.user
        linked_operation_task = entry.linked_operation_tasks.first

        {
          id: entry.id,
          work_date: entry.work_date.iso8601,
          start_time: entry.start_time&.in_time_zone(tz)&.strftime("%H:%M"),
          end_time: entry.end_time&.in_time_zone(tz)&.strftime("%H:%M"),
          formatted_start_time: entry.formatted_start_time,
          formatted_end_time: entry.formatted_end_time,
          hours: entry.hours.to_f,
          break_minutes: entry.break_minutes,
          description: entry.description,
          entry_method: entry.entry_method,
          status: entry.status,
          admin_override: entry.admin_override,
          attendance_status: entry.attendance_status,
          approval_status: entry.approval_status,
          overtime_status: entry.overtime_status,
          approval_reasons: approval_reasons_for(entry),
          clock_in_at: entry.clock_in_at&.iso8601,
          clock_out_at: entry.clock_out_at&.iso8601,
          approved_by: entry.approved_by ? {
            id: entry.approved_by.id,
            full_name: entry.approved_by.full_name
          } : nil,
          approved_at: entry.approved_at&.iso8601,
          approval_note: entry.approval_note,
          overtime_approved_by: entry.overtime_approved_by ? {
            id: entry.overtime_approved_by.id,
            full_name: entry.overtime_approved_by.full_name
          } : nil,
          overtime_approved_at: entry.overtime_approved_at&.iso8601,
          overtime_note: entry.overtime_note,
          schedule: entry.schedule ? {
            id: entry.schedule.id,
            start_time: entry.schedule.formatted_start_time,
            end_time: entry.schedule.formatted_end_time
          } : nil,
          breaks: entry.time_entry_breaks.sort_by(&:start_time).map { |entry_break|
            {
              id: entry_break.id,
              start_time: entry_break.start_time.iso8601,
              end_time: entry_break.end_time&.iso8601,
              duration_minutes: entry_break.duration_minutes,
              active: entry_break.active?
            }
          },
          user: entry_user ? {
            id: entry_user.id,
            email: entry_user.email,
            display_name: entry_user.display_name,
            full_name: entry_user.full_name
          } : nil,
          time_category: entry.time_category ? {
            id: entry.time_category.id,
            name: entry.time_category.name
          } : nil,
          client: entry.client ? {
            id: entry.client.id,
            name: "#{entry.client.first_name} #{entry.client.last_name}".strip
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
          linked_operation_task: linked_operation_task ? {
            id: linked_operation_task.id,
            title: linked_operation_task.title
          } : nil,
          locked_at: entry.locked_at&.iso8601,
          created_at: entry.created_at.iso8601,
          updated_at: entry.updated_at.iso8601
        }
      end

      def calculate_summary(entries)
        aggregate_scope = entries.except(:includes, :eager_load, :preload, :order, :limit, :offset)
        row = aggregate_scope.pick(
          Arel.sql("COALESCE(SUM(time_entries.hours), 0)"),
          Arel.sql("COALESCE(SUM(time_entries.break_minutes), 0)"),
          Arel.sql("COUNT(time_entries.id)")
        )
        total_hours, total_break_minutes, entry_count = row || [ 0, 0, 0 ]
        {
          total_hours: total_hours.to_f,
          total_break_hours: (total_break_minutes.to_i / 60.0).round(2),
          entry_count: entry_count.to_i
        }
      end

      def approval_status_value(value)
        value.to_s == "approved_or_standard" ? [ "approved", nil ] : value
      end

      def pending_approval_filter_params
        exact_date = parse_pending_date_param(:date)
        return if performed?

        start_date = parse_pending_date_param(:start_date)
        return if performed?

        end_date = parse_pending_date_param(:end_date)
        return if performed?

        through_date = parse_pending_date_param(:through_date)
        return if performed?

        since_date = parse_pending_date_param(:since_date)
        return if performed?

        if exact_date
          start_date = exact_date
          end_date = exact_date
        end

        if start_date && end_date && end_date < start_date
          render json: { error: "end_date must be on or after start_date" }, status: :unprocessable_entity
          return
        end

        sort = params[:sort].presence || "work_date"
        sort = "work_date" unless PENDING_APPROVAL_SORTS.include?(sort)

        direction = params[:direction].to_s.downcase
        direction = "asc" unless PENDING_APPROVAL_DIRECTIONS.include?(direction)

        user_id = positive_integer_filter_param(:user_id)
        return if performed?

        time_category_id = positive_integer_filter_param(:time_category_id)
        return if performed?

        client_id = positive_integer_filter_param(:client_id)
        return if performed?

        service_type_id = positive_integer_filter_param(:service_type_id)
        return if performed?

        service_task_id = positive_integer_filter_param(:service_task_id)
        return if performed?

        approval_type = allowed_filter_param(:approval_type, PENDING_APPROVAL_TYPES)
        return if performed?

        entry_method = allowed_filter_param(:entry_method, TimeEntry::ENTRY_METHODS)
        return if performed?

        {
          start_date: start_date,
          end_date: end_date,
          through_date: through_date,
          since_date: since_date,
          user_id: user_id,
          time_category_id: time_category_id,
          client_id: client_id,
          service_type_id: service_type_id,
          service_task_id: service_task_id,
          approval_type: approval_type,
          entry_method: entry_method,
          sort: sort,
          direction: direction
        }
      end

      def parse_pending_date_param(key)
        return nil if params[key].blank?

        Date.iso8601(params[key].to_s)
      rescue Date::Error
        render json: { error: "#{key} must be a valid ISO 8601 date (YYYY-MM-DD)" }, status: :unprocessable_entity
        nil
      end

      def positive_integer_filter_param(key)
        return nil if params[key].blank?

        value = Integer(params[key], 10)
        return value if value.positive?

        render json: { error: "#{key} must be a positive integer" }, status: :unprocessable_entity
        nil
      rescue ArgumentError
        render json: { error: "#{key} must be a positive integer" }, status: :unprocessable_entity
        nil
      end

      def allowed_filter_param(key, allowed_values)
        return nil if params[key].blank?

        value = params[key].to_s
        return value if allowed_values.include?(value)

        render json: { error: "#{key} is not supported" }, status: :unprocessable_entity
        nil
      end

      def serialize_pending_approval_filters(filters)
        filters.compact.transform_values do |value|
          value.respond_to?(:iso8601) ? value.iso8601 : value
        end
      end

      def apply_pending_approval_filters(entries, filters)
        return entries if performed?

        if filters[:start_date] && filters[:end_date]
          entries = entries.where(work_date: filters[:start_date]..filters[:end_date])
        elsif filters[:start_date]
          entries = entries.where("time_entries.work_date >= ?", filters[:start_date])
        elsif filters[:end_date]
          entries = entries.where("time_entries.work_date <= ?", filters[:end_date])
        end

        entries = entries.where("time_entries.work_date <= ?", filters[:through_date]) if filters[:through_date]
        entries = entries.where("time_entries.work_date >= ?", filters[:since_date]) if filters[:since_date]
        entries = entries.where(user_id: filters[:user_id]) if filters[:user_id]
        entries = entries.where(time_category_id: filters[:time_category_id]) if filters[:time_category_id]
        entries = entries.where(client_id: filters[:client_id]) if filters[:client_id]
        entries = entries.where(service_type_id: filters[:service_type_id]) if filters[:service_type_id]
        entries = entries.where(service_task_id: filters[:service_task_id]) if filters[:service_task_id]
        entries = entries.where(entry_method: filters[:entry_method]) if filters[:entry_method]

        case filters[:approval_type]
        when "time_entry"
          entries = entries.where(approval_status: "pending")
        when "overtime"
          entries = entries.where(overtime_status: "pending")
        when "both"
          entries = entries.where(approval_status: "pending", overtime_status: "pending")
        end

        entries
      end

      def apply_pending_approval_sort(entries, sort, direction)
        dir = direction == "desc" ? :desc : :asc
        time_entries_table = TimeEntry.arel_table

        case sort
        when "created_at"
          entries.order(created_at: dir, work_date: :asc, start_time: :asc, id: :asc)
        when "employee"
          users_table = User.arel_table
          entries.joins(:user).order(
            lower_order(users_table[:last_name], dir),
            lower_order(users_table[:first_name], dir),
            lower_order(users_table[:email], dir),
            work_date: :asc,
            start_time: :asc,
            id: :asc
          )
        when "hours"
          entries.order(hours: dir, work_date: :asc, start_time: :asc, id: :asc)
        when "approval_type"
          entries.order(
            approval_type_order(time_entries_table, dir),
            work_date: :asc,
            start_time: :asc,
            id: :asc
          )
        when "category"
          categories_table = TimeCategory.arel_table
          entries.left_outer_joins(:time_category).order(
            lower_order(categories_table[:name], dir),
            work_date: :asc,
            start_time: :asc,
            id: :asc
          )
        when "client"
          clients_table = Client.arel_table
          entries.left_outer_joins(:client).order(
            lower_order(clients_table[:last_name], dir),
            lower_order(clients_table[:first_name], dir),
            work_date: :asc,
            start_time: :asc,
            id: :asc
          )
        when "service"
          services_table = ServiceType.arel_table
          entries.left_outer_joins(:service_type).order(
            lower_order(services_table[:name], dir),
            work_date: :asc,
            start_time: :asc,
            id: :asc
          )
        else
          entries.order(work_date: dir, start_time: dir, created_at: dir, id: dir)
        end
      end

      def lower_order(attribute, direction)
        Arel::Nodes::NamedFunction.new("LOWER", [ attribute ]).public_send(direction)
      end

      def approval_type_order(time_entries_table, direction)
        Arel::Nodes::Case.new
          .when(time_entries_table[:approval_status].eq("pending").and(time_entries_table[:overtime_status].eq("pending"))).then(0)
          .when(time_entries_table[:approval_status].eq("pending")).then(1)
          .when(time_entries_table[:overtime_status].eq("pending")).then(2)
          .else(3)
          .public_send(direction)
      end

      def pending_approvals_summary(entries)
        scope = pending_approval_summary_scope(entries)
        row = scope.pick(
          Arel.sql("COALESCE(SUM(time_entries.hours), 0)"),
          Arel.sql("COUNT(time_entries.id)"),
          Arel.sql("MIN(time_entries.work_date)"),
          Arel.sql("MAX(time_entries.work_date)"),
          Arel.sql("SUM(CASE WHEN time_entries.approval_status = 'pending' THEN 1 ELSE 0 END)"),
          Arel.sql("SUM(CASE WHEN time_entries.overtime_status = 'pending' THEN 1 ELSE 0 END)"),
          Arel.sql("SUM(CASE WHEN time_entries.entry_method = 'manual' THEN 1 ELSE 0 END)"),
          Arel.sql("SUM(CASE WHEN time_entries.entry_method = 'clock' THEN 1 ELSE 0 END)")
        )
        total_hours, entry_count, oldest_work_date, newest_work_date, pending_time_count, pending_overtime_count, manual_count, clock_count = row || [ 0, 0, nil, nil, 0, 0, 0, 0 ]

        counts_by_date = scope.group(:work_date).order(:work_date).pluck(
          :work_date,
          Arel.sql("COUNT(time_entries.id)"),
          Arel.sql("COALESCE(SUM(time_entries.hours), 0)")
        ).map do |date, count, hours|
          { work_date: date.iso8601, count: count.to_i, hours: hours.to_f.round(2) }
        end

        counts_by_client = scope.left_outer_joins(:client).group("clients.id", "clients.first_name", "clients.last_name").pluck(
          "clients.id",
          "clients.first_name",
          "clients.last_name",
          Arel.sql("COUNT(time_entries.id)"),
          Arel.sql("COALESCE(SUM(time_entries.hours), 0)")
        ).map do |id, first_name, last_name, count, hours|
          {
            id: id,
            name: id ? [ first_name, last_name ].compact.join(" ").strip : "No client",
            count: count.to_i,
            hours: hours.to_f.round(2)
          }
        end

        {
          total_hours: total_hours.to_f.round(2),
          entry_count: entry_count.to_i,
          oldest_work_date: oldest_work_date&.iso8601,
          newest_work_date: newest_work_date&.iso8601,
          pending_time_entry_count: pending_time_count.to_i,
          pending_overtime_count: pending_overtime_count.to_i,
          manual_count: manual_count.to_i,
          clock_count: clock_count.to_i,
          counts_by_date: counts_by_date,
          counts_by_client: counts_by_client
        }
      end

      def pending_approval_summary_scope(entries)
        ids_scope = entries.except(:includes, :eager_load, :preload, :order, :limit, :offset).select("time_entries.id")
        TimeEntry.where(id: ids_scope)
      end

      def pending_approval_entries_scope
        TimeEntry
          .preload(:user, :schedule, :approved_by, :overtime_approved_by, :time_entry_breaks,
                   :time_category, :client, :tax_return, :service_type, :service_task,
                   :linked_operation_tasks)
          .where("time_entries.approval_status = ? OR time_entries.overtime_status = ?", "pending", "pending")
      end

      def approval_reasons_for(entry)
        reasons = []
        note = entry.approval_note.to_s.downcase

        if entry.approval_status == "pending"
          reasons << { key: "corrected_clock_out", label: "Corrected clock-out" } if note.include?("corrected clock-out")
          reasons << { key: "employee_edited", label: "Employee edited" } if note.include?("employee edited")

          if entry.manual_entry?
            reasons << { key: "manual_entry", label: "Manual entry" }
          elsif entry.clock_entry? && (entry.schedule_id.blank? || note.include?("without a schedule"))
            reasons << { key: "unscheduled_clock", label: "Unscheduled clock" }
          elsif reasons.empty?
            reasons << { key: "time_review", label: "Needs time review" }
          end
        end

        reasons << { key: "overtime", label: "Overtime" } if entry.overtime_status == "pending"
        reasons << { key: "admin_override", label: "Admin override" } if entry.admin_override?

        reasons.uniq { |reason| reason[:key] }
      end

      def append_review_note(existing_note)
        review_note = "Employee edited time entry — awaiting admin review"
        return review_note if existing_note.blank?
        return existing_note if existing_note.include?(review_note)

        "#{existing_note}\n\n#{review_note}"
      end
    end
  end
end
