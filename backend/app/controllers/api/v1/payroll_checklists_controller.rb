# frozen_string_literal: true

module Api
  module V1
    class PayrollChecklistsController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!

      # GET /api/v1/payroll_checklists/board?start=YYYY-MM-DD&end=YYYY-MM-DD
      def board
        default_template = PayrollChecklistTemplateService.ensure_default_template!(created_by: current_user)
        start_date = parse_date(params[:start]) || Date.current.beginning_of_month
        end_date = parse_date(params[:end]) || Date.current.end_of_month
        if end_date < start_date
          return render json: { error: "end must be on or after start" }, status: :unprocessable_entity
        end

        payroll_template_ids = OperationTemplate.where(category: "payroll", is_active: true).pluck(:id)
        payroll_template_ids = [default_template.id] if payroll_template_ids.empty?

        periods = build_periods(start_date, end_date, period_anchor_for(payroll_template_ids, start_date))
        active_auto_assignments = ClientOperationAssignment
          .includes(:client, :operation_template)
          .where(operation_template_id: payroll_template_ids, assignment_status: "active", auto_generate: true)

        EnsurePayrollChecklistPeriodsService.new(
          assignments: active_auto_assignments,
          period_starts: periods.map { |period| period[:start] },
          generated_by: current_user
        ).call

        assignments = ClientOperationAssignment
          .where(operation_template_id: payroll_template_ids)
          .order(created_at: :desc)
          .group_by(&:client_id)
          .transform_values { |list| list.first }

        cycles = OperationCycle
          .includes(:operation_tasks)
          .where(operation_template_id: payroll_template_ids, period_start: periods.first[:start]..periods.last[:start], period_end: periods.first[:end]..periods.last[:end])
        cycles_by_key = cycles.index_by { |cycle| [cycle.client_id, cycle.operation_template_id, cycle.period_start, cycle.period_end] }

        client_ids = (assignments.keys + cycles.pluck(:client_id)).uniq
        clients = Client.where(id: client_ids).order(:last_name, :first_name)
        template_tasks_by_template_id = OperationTemplateTask
          .where(operation_template_id: payroll_template_ids, is_active: true)
          .group_by(&:operation_template_id)

        rows = clients.map do |client|
          assignment = assignments[client.id]
          preferred_template_id =
            assignment&.operation_template_id ||
            cycles.select { |cycle| cycle.client_id == client.id }.max_by(&:period_start)&.operation_template_id ||
            default_template.id
          template_task_ids = (template_tasks_by_template_id[preferred_template_id] || []).map(&:id)
          excluded = if assignment&.operation_template_id == preferred_template_id
            Array(assignment.excluded_template_task_ids).map(&:to_i)
          else
            []
          end
          expected_total = (template_task_ids - excluded).size

          cells = periods.map do |period|
            cycle = cycles_by_key[[client.id, preferred_template_id, period[:start], period[:end]]]
            done_count = cycle ? cycle.operation_tasks.where(status: "done").count : 0
            total_count = cycle ? cycle.operation_tasks.count : expected_total

            {
              period_start: period[:start].iso8601,
              period_end: period[:end].iso8601,
              checklist_period_id: cycle&.id,
              done_count: done_count,
              total_count: total_count,
              status: cycle ? checklist_period_status(cycle.status) : "open"
            }
          end

          {
            client_id: client.id,
            client_name: client.full_name,
            cells: cells
          }
        end

        render json: {
          periods: periods.map do |period|
            {
              start: period[:start].iso8601,
              end: period[:end].iso8601,
              label: period_label(period[:start], period[:end])
            }
          end,
          rows: rows
        }
      end

      private

      def parse_date(value)
        return nil if value.blank?

        Date.parse(value)
      rescue Date::Error
        nil
      end

      def build_periods(start_date, end_date, anchor_date)
        periods = []
        cursor = aligned_period_start(anchor_date, start_date)

        while cursor <= end_date
          period_end = [cursor + 13.days, end_date].min
          full_period_end = cursor + 13.days
          periods << { start: cursor, end: full_period_end } if full_period_end >= start_date
          cursor += 14.days
        end

        periods
      end

      def period_anchor_for(template_ids, start_date)
        assignment_anchor = ClientOperationAssignment.where(operation_template_id: template_ids).where.not(cadence_anchor: nil).minimum(:cadence_anchor)
        assignment_anchor || Date.new(start_date.year, 1, 1)
      end

      def aligned_period_start(anchor_date, start_date)
        anchor = anchor_date.to_date
        return anchor if start_date <= anchor

        periods_since_anchor = ((start_date - anchor) / 14.0).floor
        anchor + (periods_since_anchor * 14)
      end

      def period_label(start_date, end_date)
        "#{start_date.strftime('%b %-d')}–#{end_date.strftime('%b %-d')}"
      end

      def checklist_period_status(cycle_status)
        cycle_status == "completed" ? "completed" : "open"
      end
    end
  end
end
