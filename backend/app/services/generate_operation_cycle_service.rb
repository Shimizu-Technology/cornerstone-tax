# frozen_string_literal: true

class GenerateOperationCycleService
  Result = Struct.new(:success?, :cycle, :errors, :duplicate?, keyword_init: true) do
    def initialize(success?: false, cycle: nil, errors: [], duplicate?: false)
      super
    end
  end

  def initialize(client:, operation_template:, period_start:, period_end:, generation_mode:, generated_by:, assignment: nil)
    @client = client
    @operation_template = operation_template
    @assignment = assignment
    @period_start = period_start
    @period_end = period_end
    @generation_mode = generation_mode
    @generated_by = generated_by
    @errors = []
  end

  def call
    return failure("Period start and period end are required") if @period_start.blank? || @period_end.blank?
    return failure("Period end must be on or after period start") if @period_end < @period_start
    return failure("Operation template is not active") unless @operation_template.is_active?

    # Check for existing cycle before attempting creation (robust duplicate detection)
    if OperationCycle.exists?(
      client_id: @client.id,
      operation_template_id: @operation_template.id,
      period_start: @period_start,
      period_end: @period_end
    )
      return Result.new(success?: false, cycle: nil, errors: ["Operation cycle already exists for this period"], duplicate?: true)
    end

    cycle = nil

    ActiveRecord::Base.transaction do
      cycle = OperationCycle.create!(
        client: @client,
        operation_template: @operation_template,
        client_operation_assignment: @assignment,
        period_start: @period_start,
        period_end: @period_end,
        cycle_label: cycle_label,
        generation_mode: @generation_mode,
        status: "active",
        generated_at: Time.current,
        generated_by: @generated_by
      )

      @operation_template.operation_template_tasks.active.ordered.find_each.with_index(1) do |template_task, idx|
        OperationTask.create!(
          operation_cycle: cycle,
          operation_template_task: template_task,
          client: @client,
          title: template_task.title,
          description: template_task.description,
          position: template_task.position.presence || idx,
          status: "not_started",
          assigned_to: template_task.default_assignee,
          due_at: calculate_due_at(template_task),
          evidence_required: template_task.evidence_required
        )
      end

      AuditLog.log(
        auditable: cycle,
        action: "created",
        user: @generated_by,
        metadata: "Generated #{@generation_mode} operation cycle for #{@operation_template.name} (#{@period_start} to #{@period_end})"
      )
    end

    Result.new(success?: true, cycle: cycle, errors: [])
  rescue ActiveRecord::RecordInvalid => e
    failure(e.record.errors.full_messages.join(", "))
  rescue ActiveRecord::RecordNotUnique
    # Race condition: another request created the cycle between our exists? check and create
    Result.new(success?: false, cycle: nil, errors: ["Operation cycle already exists for this period"], duplicate?: true)
  rescue StandardError => e
    failure(e.message)
  end

  private

  def calculate_due_at(template_task)
    return nil if template_task.due_offset_value.blank?

    base =
      if template_task.due_offset_from == "cycle_end"
        @period_end.end_of_day
      else
        @period_start.beginning_of_day
      end

    if template_task.due_offset_unit == "hours"
      base + template_task.due_offset_value.hours
    else
      base + template_task.due_offset_value.days
    end
  end

  def cycle_label
    "#{@operation_template.name} (#{@period_start} - #{@period_end})"
  end

  def failure(message)
    @errors << message
    Result.new(success?: false, cycle: nil, errors: @errors)
  end
end
