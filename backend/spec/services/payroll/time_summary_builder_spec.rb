# frozen_string_literal: true

require "rails_helper"

RSpec.describe Payroll::TimeSummaryBuilder do
  it "emits v1 with explicit daily coverage across the requested range" do
    employee = create(:user, :employee)
    entry = create(
      :time_entry,
      user: employee,
      work_date: Date.new(2026, 5, 20),
      approval_status: nil,
      status: "completed"
    )

    payload = described_class.new(start_date: "2026-05-18", end_date: "2026-05-24").call
    exported_employee = payload.fetch(:employees).first

    expect(payload).to include(
      schema_version: "1.0",
      source: "cornerstone_tax",
      start_date: "2026-05-18",
      end_date: "2026-05-24"
    )
    expect(exported_employee.fetch(:days).map { |day| day.fetch(:work_date) }).to eq(
      (Date.new(2026, 5, 18)..Date.new(2026, 5, 24)).map(&:iso8601)
    )
    expect(exported_employee.fetch(:days).find { |day| day.fetch(:work_date) == "2026-05-19" }).to include(
      hours: 0.0,
      entry_ids: [],
      categories: []
    )
    expect(exported_employee.fetch(:days).find { |day| day.fetch(:work_date) == "2026-05-20" }).to include(
      hours: entry.hours.to_f,
      entry_ids: [ entry.id ]
    )
    expect(exported_employee[:total_hours]).to eq(entry.hours.to_f)
  end
end
