# frozen_string_literal: true

require "rails_helper"
require "csv"

RSpec.describe "Api::V1::Admin::HoursReports", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee, first_name: "Alice", last_name: "Smith") }
  let(:other_employee) { create(:user, :employee, first_name: "Bob", last_name: "Jones") }
  let(:category) { TimeCategory.create!(name: "Tax Prep") }
  let(:client) { Client.create!(first_name: "Casey", last_name: "Client") }

  let(:auth_headers_for) do
    ->(user) { { "Authorization" => "Bearer test_token_#{user.id}" } }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def create_entry(user:, work_date:, start_time:, end_time:, **attrs)
    tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
    create(:time_entry,
           {
             user: user,
             work_date: work_date,
             start_time: tz.parse("#{work_date.iso8601} #{start_time}"),
             end_time: tz.parse("#{work_date.iso8601} #{end_time}"),
             approval_status: "approved"
           }.merge(attrs))
  end

  before do
    Setting.set("overtime_daily_threshold_hours", "8")
    Setting.set("overtime_weekly_threshold_hours", "40")
  end

  describe "GET /api/v1/admin/hours_report" do
    let(:work_date) { Date.current.beginning_of_week(:sunday) + 1.day }

    before do
      create_entry(user: employee, work_date: work_date, start_time: "08:00", end_time: "13:00", time_category: category, client: client)
      create_entry(user: employee, work_date: work_date, start_time: "13:00", end_time: "18:00", time_category: category, client: client)
      create_entry(user: other_employee, work_date: work_date, start_time: "09:00", end_time: "11:00", approval_status: "pending")
    end

    it "returns admin-only hours report summaries with daily overtime allocation" do
      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: work_date.iso8601, approval_status: "approved_or_standard" },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:summary, :total_hours)).to eq(10.0)
      expect(json.dig(:summary, :regular_hours)).to eq(8.0)
      expect(json.dig(:summary, :overtime_hours)).to eq(2.0)
      expect(json.dig(:summary, :entries_count)).to eq(2)

      employee_report = json[:employees].find { |row| row[:id] == employee.id }
      expect(employee_report[:ready]).to eq(true)
      expect(employee_report[:categories].first[:name]).to eq("Tax Prep")
      expect(employee_report[:clients].first[:name]).to eq("Casey Client")
      expect(employee_report[:days].first[:entries].size).to eq(2)
    end

    it "honors client and employee filters" do
      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: work_date.iso8601, user_id: employee.id, client_id: client.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:employees].map { |row| row[:id] }).to eq([ employee.id ])
      expect(json.dig(:summary, :total_hours)).to eq(10.0)
    end

    it "keeps boundary-week context hours out of period weekly breakdown totals" do
      period_date = work_date + 2.days
      create_entry(user: employee, work_date: period_date, start_time: "09:00", end_time: "13:00", time_category: category, client: client)

      get "/api/v1/admin/hours_report",
          params: {
            start_date: period_date.iso8601,
            end_date: period_date.iso8601,
            user_id: employee.id,
            client_id: client.id,
            approval_status: "approved_or_standard"
          },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:summary, :total_hours)).to eq(4.0)

      employee_report = json[:employees].find { |row| row[:id] == employee.id }
      week = employee_report[:weeks].first
      expect(week[:period_hours]).to eq(4.0)
      expect(week[:regular_hours]).to eq(4.0)
      expect(week[:overtime_hours]).to eq(0.0)
      expect(week[:context_hours]).to eq(10.0)
      expect(week[:context_note]).to include("outside this filtered report selection")
    end

    it "blocks employees" do
      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: work_date.iso8601 },
          headers: auth_headers_for[employee]

      expect(response).to have_http_status(:forbidden)
    end

    it "validates date ranges" do
      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: (work_date - 1.day).iso8601 },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("end_date")
    end

    it "reports partial and complete finalization coverage without making it a report prerequisite" do
      week_start = work_date.beginning_of_week(:sunday)
      TimePeriodLock.create!(
        start_date: week_start,
        end_date: week_start + 6.days,
        locked_by: admin,
        locked_at: Time.current,
        reason: "First payroll week complete"
      )

      get "/api/v1/admin/hours_report",
          params: { start_date: week_start.iso8601, end_date: (week_start + 13.days).iso8601 },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:finalization, :status)).to eq("partially_finalized")
      expect(json.dig(:finalization, :finalized_days)).to eq(7)

      TimePeriodLock.create!(
        start_date: week_start + 7.days,
        end_date: week_start + 13.days,
        locked_by: admin,
        locked_at: Time.current,
        reason: "Second payroll week complete"
      )

      get "/api/v1/admin/hours_report",
          params: { start_date: week_start.iso8601, end_date: (week_start + 13.days).iso8601 },
          headers: auth_headers_for[admin]

      expect(json.dig(:finalization, :status)).to eq("finalized")
      expect(json.dig(:finalization, :finalized_days)).to eq(14)
    end

    it "keeps readiness in draft when an approved-only display filter hides a pending entry" do
      create_entry(user: employee, work_date: work_date + 1.day, start_time: "09:00", end_time: "11:00", approval_status: "pending")

      get "/api/v1/admin/hours_report",
          params: {
            start_date: work_date.iso8601,
            end_date: (work_date + 1.day).iso8601,
            user_id: employee.id,
            approval_status: "approved_or_standard"
          },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:ready]).to eq(false)
      expect(json.dig(:summary, :pending_count)).to eq(1)
      expect(json.dig(:employees, 0, :ready)).to eq(false)
    end

    it "treats denied entries as visible exclusions instead of permanently blocking completion" do
      denied = create_entry(user: employee, work_date: work_date + 1.day, start_time: "09:00", end_time: "11:00", approval_status: "denied")

      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: (work_date + 1.day).iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:ready]).to eq(true)
      expect(json.dig(:summary, :denied_count)).to eq(1)
      expect(json.dig(:summary, :entries_count)).to eq(2)
      expect(json.dig(:employees, 0, :days).flatten.to_s).not_to include(denied.id.to_s)
    end
  end

  describe "report exports" do
    let(:work_date) { Date.new(2026, 6, 16) }

    it "generates a Unicode-safe employee PDF without requiring a finalized week and snapshots domain context" do
      employee.update!(first_name: "Māria", last_name: "Čamoru 李")
      category.update!(name: "Māpåla Support")
      client.update!(business_name: "Åmot Consulting")
      service = ServiceType.create!(name: "Tax Advisory")
      task = ServiceTask.create!(service_type: service, name: "Federal review")
      tax_return = TaxReturn.create!(
        client: client,
        tax_year: 2026,
        return_type: "individual",
        jurisdiction: "guam",
        source: "admin_created",
        priority: "normal",
        payment_status: "unpaid",
        filing_status: "not_filed",
        signature_status: "not_needed",
        tax_outcome_status: "unknown"
      )
      context_entry = create_entry(user: employee, work_date: work_date - 1.day, start_time: "08:00", end_time: "12:00", time_category: category)
      entry = create_entry(
        user: employee,
        work_date: work_date,
        start_time: "08:00",
        end_time: "14:00",
        time_category: category,
        client: client,
        tax_return: tax_return,
        service_type: service,
        service_task: task
      )

      expect do
        get "/api/v1/admin/hours_report/pdf",
            params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601, user_id: employee.id, time_category_id: category.id },
            headers: auth_headers_for[admin]
      end.to change(ReportExport, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/pdf")
      expect(response.body).to start_with("%PDF")
      expect(response.headers.fetch("Content-Disposition")).to include("Cornerstone_Timesheet_Maria_Camoru")

      export = ReportExport.last
      expect(export).to have_attributes(export_type: "employee_timesheet_pdf", readiness_status: "complete", protects_entries: true)
      expect(export.entry_ids).to contain_exactly(context_entry.id, entry.id)
      expect(export.report_context.dig("finalization", "status")).to eq("not_finalized")
      snapshot = export.entry_snapshot.find { |row| row["id"] == entry.id }
      expect(snapshot.dig("client", "name")).to eq("Åmot Consulting")
      expect(snapshot.dig("service_type", "name")).to eq("Tax Advisory")
      expect(snapshot.dig("service_task", "name")).to eq("Federal review")
      expect(snapshot.dig("tax_return", "tax_year")).to eq(2026)
    end

    it "generates a consolidated PDF for all matching employees" do
      create_entry(user: employee, work_date: work_date, start_time: "08:00", end_time: "14:00", time_category: category)
      create_entry(user: other_employee, work_date: work_date + 1.day, start_time: "09:00", end_time: "16:00", time_category: category)

      get "/api/v1/admin/hours_report/pdf",
          params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601 },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/pdf")
      expect(response.body).to start_with("%PDF")
      expect(response.headers.fetch("Content-Disposition")).to include("Cornerstone_Payroll_Hours")
      expect(ReportExport.last.employee_ids).to contain_exactly(employee.id, other_employee.id)
    end

    it "requires explicit acknowledgement before creating a draft PDF" do
      create_entry(user: employee, work_date: work_date, start_time: "08:00", end_time: "14:00", approval_status: "pending")

      get "/api/v1/admin/hours_report/pdf",
          params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:code]).to eq("draft_acknowledgement_required")
      expect(ReportExport.where(export_type: "employee_timesheet_pdf")).to be_empty

      get "/api/v1/admin/hours_report/pdf",
          params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601, user_id: employee.id, acknowledge_draft: true },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(ReportExport.last.readiness_status).to eq("draft")
    end

    it "does not require draft acknowledgement when the only issue is a denied exclusion" do
      create_entry(user: employee, work_date: work_date, start_time: "08:00", end_time: "14:00", approval_status: "denied")

      get "/api/v1/admin/hours_report/pdf",
          params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(ReportExport.last.readiness_status).to eq("complete")
      expect(ReportExport.last.issues["denied_count"]).to eq(1)
    end

    it "exports internal detailed CSV rows with formula-injection protection and audit references" do
      entry = create_entry(user: employee, work_date: work_date, start_time: "08:00", end_time: "14:00", time_category: category, client: client)
      entry.update!(description: "=HYPERLINK(\"https://example.test\", \"Open\")", approved_by: admin, approved_at: Time.current)

      get "/api/v1/admin/hours_report/detailed_csv",
          params: { start_date: work_date.iso8601, end_date: (work_date + 14.days).iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/csv")
      rows = CSV.parse(response.body, headers: true)
      expect(rows.length).to eq(1)
      expect(rows.first["Description"]).to start_with("'=")
      expect(rows.first["Export Reference"]).to eq(ReportExport.last.public_id)
      expect(rows.first["Client"]).to eq("Casey Client")
    end
  end
end
