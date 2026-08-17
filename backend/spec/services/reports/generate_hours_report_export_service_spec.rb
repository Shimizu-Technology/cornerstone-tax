# frozen_string_literal: true

require "rails_helper"

RSpec.describe Reports::GenerateHoursReportExportService do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee, first_name: "Alice", last_name: "Smith") }
  let(:work_date) { Date.new(2026, 6, 16) }
  let(:report_params) do
    {
      start_date: work_date.iso8601,
      end_date: (work_date + 14.days).iso8601,
      user_id: employee.id
    }
  end

  def create_entry(approval_status: "approved")
    tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
    create(
      :time_entry,
      user: employee,
      work_date: work_date,
      start_time: tz.parse("#{work_date.iso8601} 08:00"),
      end_time: tz.parse("#{work_date.iso8601} 14:00"),
      approval_status: approval_status
    )
  end

  it "returns an audited employee PDF result without requiring week finalization" do
    entry = create_entry

    result = described_class.new(
      export_type: "employee_timesheet_pdf",
      report_params: report_params,
      generated_by: admin
    ).call

    expect(result.content).to start_with("%PDF")
    expect(result.content_type).to eq("application/pdf")
    expect(result.filename).to eq("Cornerstone_Timesheet_Alice_Smith_2026-06-16_to_2026-06-30.pdf")

    export = ReportExport.last
    expect(export).to have_attributes(
      export_type: "employee_timesheet_pdf",
      readiness_status: "complete",
      generated_by: admin,
      protects_entries: true
    )
    expect(export.entry_ids).to include(entry.id)
    expect(export.report_context.dig("finalization", "status")).to eq("not_finalized")
  end

  it "requires an explicit draft acknowledgement before recording an incomplete export" do
    create_entry(approval_status: "pending")
    service = described_class.new(
      export_type: "employee_timesheet_pdf",
      report_params: report_params,
      generated_by: admin
    )

    expect do
      expect { service.call }
        .to raise_error(described_class::DraftAcknowledgementRequired) { |error| expect(error.issues[:pending_count]).to eq(1) }
    end.not_to change(ReportExport, :count)
  end

  it "records a draft export after acknowledgement" do
    create_entry(approval_status: "pending")

    expect do
      described_class.new(
        export_type: "payroll_summary_csv",
        report_params: report_params,
        generated_by: admin,
        acknowledge_draft: true
      ).call
    end.to change(ReportExport, :count).by(1)

    expect(ReportExport.last).to have_attributes(export_type: "payroll_summary_csv", readiness_status: "draft")
  end

  it "rejects unsupported export types without creating an audit record" do
    expect do
      expect do
        described_class.new(export_type: "unknown", report_params: report_params, generated_by: admin).call
      end.to raise_error(ArgumentError, "Unsupported report export type")
    end.not_to change(ReportExport, :count)
  end
end
