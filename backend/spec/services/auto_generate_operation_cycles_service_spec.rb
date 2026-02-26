# frozen_string_literal: true

require "rails_helper"

RSpec.describe AutoGenerateOperationCyclesService, type: :service do
  include ActiveSupport::Testing::TimeHelpers

  let!(:admin) do
    User.create!(
      clerk_id: "spec-admin-auto-generate-service",
      email: "admin-auto-generate-service@example.com",
      role: "admin",
      first_name: "Spec",
      last_name: "Admin"
    )
  end

  let!(:client) do
    Client.create!(
      first_name: "Auto",
      last_name: "Client",
      email: "auto-client@example.com"
    )
  end

  let!(:template) do
    OperationTemplate.create!(
      name: "Auto Generate Service Template #{SecureRandom.hex(4)}",
      category: "general",
      recurrence_type: "monthly",
      auto_generate: true,
      created_by: admin
    )
  end

  let!(:template_task) do
    template.operation_template_tasks.create!(title: "Recurring Task", position: 1)
  end

  let!(:assignment) do
    ClientOperationAssignment.create!(
      client: client,
      operation_template: template,
      auto_generate: true,
      assignment_status: "active",
      starts_on: Date.current.beginning_of_month,
      created_by: admin
    )
  end

  def create_auto_template!
    OperationTemplate.create!(
      name: "Auto Template #{SecureRandom.hex(4)}",
      category: "general",
      recurrence_type: "monthly",
      auto_generate: true,
      created_by: admin
    ).tap do |new_template|
      new_template.operation_template_tasks.create!(title: "Task #{SecureRandom.hex(3)}", position: 1)
    end
  end

  def create_auto_assignment!(operation_template:, starts_on: nil, cadence_type: "monthly", cadence_interval: nil, cadence_anchor: nil)
    ClientOperationAssignment.create!(
      client: client,
      operation_template: operation_template,
      cadence_type: cadence_type,
      cadence_interval: cadence_interval,
      cadence_anchor: cadence_anchor || starts_on,
      auto_generate: true,
      assignment_status: "active",
      starts_on: starts_on,
      created_by: admin
    )
  end

  describe "#call" do
    it "generates a cycle for eligible assignments" do
      run_date = Date.current
      result = described_class.new(run_date: run_date, generated_by: admin).call

      expect(result.generated_count).to eq(1)
      expect(result.skipped_count).to eq(0)
      expect(result.errors).to eq([])

      cycle = OperationCycle.find_by(client: client, operation_template: template, period_start: run_date.beginning_of_month)
      expect(cycle).to be_present
      expect(cycle.operation_tasks.count).to eq(1)
    end

    it "is idempotent for the same run date" do
      run_date = Date.current
      described_class.new(run_date: run_date, generated_by: admin).call
      result = described_class.new(run_date: run_date, generated_by: admin).call

      expect(result.generated_count).to eq(0)
      expect(result.skipped_count).to eq(1)
      expect(result.errors).to eq([])
    end

    it "uses correct month-end boundaries for monthly recurrence" do
      monthly_template = create_auto_template!
      create_auto_assignment!(operation_template: monthly_template, starts_on: nil, cadence_type: "monthly")
      run_date = Date.new(2026, 1, 31)

      described_class.new(run_date: run_date, generated_by: admin).call

      cycle = OperationCycle.find_by(client: client, operation_template: monthly_template, period_start: Date.new(2026, 1, 1))
      expect(cycle).to be_present
      expect(cycle.period_end).to eq(Date.new(2026, 1, 31))
    end

    it "uses leap-year February boundaries for monthly recurrence" do
      monthly_template = create_auto_template!
      create_auto_assignment!(operation_template: monthly_template, starts_on: nil, cadence_type: "monthly")
      run_date = Date.new(2024, 2, 29)

      described_class.new(run_date: run_date, generated_by: admin).call

      cycle = OperationCycle.find_by(client: client, operation_template: monthly_template, period_start: Date.new(2024, 2, 1))
      expect(cycle).to be_present
      expect(cycle.period_end).to eq(Date.new(2024, 2, 29))
    end

    it "respects app timezone when deriving default run date" do
      monthly_template = create_auto_template!
      create_auto_assignment!(operation_template: monthly_template, starts_on: nil, cadence_type: "monthly")

      Time.use_zone("Pacific/Honolulu") do
        travel_to Time.utc(2026, 1, 1, 8, 30, 0) do
          described_class.new(generated_by: admin).call
        end
      end

      cycle = OperationCycle.find_by(client: client, operation_template: monthly_template, period_start: Date.new(2025, 12, 1))
      expect(cycle).to be_present
      expect(cycle.period_end).to eq(Date.new(2025, 12, 31))
    end

    it "uses assignment cadence for biweekly runs" do
      template = create_auto_template!
      create_auto_assignment!(
        operation_template: template,
        starts_on: Date.new(2026, 1, 1),
        cadence_type: "biweekly",
        cadence_anchor: Date.new(2026, 1, 1)
      )

      described_class.new(run_date: Date.new(2026, 1, 20), generated_by: admin).call

      cycle = OperationCycle.find_by(client: client, operation_template: template, period_start: Date.new(2026, 1, 15))
      expect(cycle).to be_present
      expect(cycle.period_end).to eq(Date.new(2026, 1, 28))
    end
  end
end
