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
      expect(employee_report[:days_worked]).to eq(1)
      expect(employee_report[:first_work_date]).to eq(work_date.iso8601)
      expect(employee_report[:last_work_date]).to eq(work_date.iso8601)
    end

    it "reports data-quality flags separately without removing approved hours" do
      flagged_date = work_date + 1.day
      long_entry = create_entry(
        user: employee,
        work_date: flagged_date,
        start_time: "08:00",
        end_time: "20:00",
        time_category: nil,
        client: nil,
        description: nil
      )
      overlapping_entry = create_entry(
        user: employee,
        work_date: flagged_date,
        start_time: "10:00",
        end_time: "12:00",
        time_category: category,
        client: client,
        description: "Verified client work"
      )

      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: flagged_date.iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:summary, :total_hours)).to eq(24.0)
      expect(json[:ready]).to eq(true)
      expect(json.dig(:quality, :status)).to eq("needs_review")
      expect(json.dig(:quality, :flagged_entries_count)).to eq(2)
      expect(json.dig(:quality, :uncategorized_count)).to eq(1)
      expect(json.dig(:quality, :missing_client_count)).to eq(1)
      expect(json.dig(:quality, :missing_description_count)).to eq(1)
      expect(json.dig(:quality, :long_shift_count)).to eq(1)
      expect(json.dig(:quality, :overlapping_entry_count)).to eq(2)

      serialized_entries = json.dig(:employees, 0, :days).flat_map { |day| day[:entries] }
      expect(serialized_entries.find { |entry| entry[:id] == long_entry.id }[:review_flags]).to contain_exactly(
        "uncategorized", "missing_client", "missing_description", "long_shift", "overlap"
      )
      expect(serialized_entries.find { |entry| entry[:id] == overlapping_entry.id }[:review_flags]).to eq([ "overlap" ])
    end

    it "detects overlaps that cross midnight into the next work date" do
      overnight_date = work_date + 1.day
      first = create_entry(user: employee, work_date: overnight_date, start_time: "22:00", end_time: "02:00", time_category: category, client: client, description: "Overnight work")
      second = create_entry(user: employee, work_date: overnight_date + 1.day, start_time: "01:00", end_time: "03:00", time_category: category, client: client, description: "Early work")

      get "/api/v1/admin/hours_report",
          params: { start_date: overnight_date.iso8601, end_date: (overnight_date + 1.day).iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:quality, :overlapping_entry_count)).to eq(2)
      flags_by_id = json.dig(:employees, 0, :days).flat_map { |day| day[:entries] }.to_h { |entry| [ entry[:id], entry[:review_flags] ] }
      expect(flags_by_id[first.id]).to include("overlap")
      expect(flags_by_id[second.id]).to include("overlap")
    end

    it "honors client and employee filters" do
      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: work_date.iso8601, user_id: employee.id, client_id: client.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:employees].map { |row| row[:id] }).to eq([ employee.id ])
      expect(json.dig(:summary, :total_hours)).to eq(10.0)
    end

    it "retains terminated employees in historical reports" do
      employee.terminate!(by: admin, effective_on: work_date + 1.day)

      get "/api/v1/admin/hours_report",
          params: { start_date: work_date.iso8601, end_date: work_date.iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:employees, 0, :id)).to eq(employee.id)
      expect(json.dig(:employees, 0, :status)).to eq("terminated")
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

    it "supports report ranges longer than 62 days" do
      start_date = work_date - 1.year

      get "/api/v1/admin/hours_report",
          params: { start_date: start_date.iso8601, end_date: work_date.iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:summary, :total_hours)).to eq(10.0)
      expect(json.dig(:summary, :entries_count)).to eq(2)
      expect(json.dig(:finalization, :selected_days)).to eq((work_date - start_date).to_i + 1)
    end

    it "counts overlapping finalization locks once across long ranges" do
      start_date = work_date - 100.days
      TimePeriodLock.create!(start_date: start_date, end_date: start_date + 9.days, locked_by: admin, locked_at: Time.current)
      TimePeriodLock.create!(start_date: start_date + 5.days, end_date: start_date + 14.days, locked_by: admin, locked_at: Time.current)

      get "/api/v1/admin/hours_report",
          params: { start_date: start_date.iso8601, end_date: work_date.iso8601, user_id: employee.id },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:finalization, :status)).to eq("partially_finalized")
      expect(json.dig(:finalization, :selected_days)).to eq(101)
      expect(json.dig(:finalization, :finalized_days)).to eq(15)
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
      included_ids = json.dig(:employees, 0, :days).flat_map { |day| day[:entries].map { |entry| entry[:id] } }
      expect(included_ids).not_to include(denied.id)
      expect(json.dig(:employees, 0, :excluded_entries).map { |entry| entry[:id] }).to include(denied.id)
    end

    context "with client, category, task and period" do
      let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }
      let(:bank_rec) { ServiceTask.create!(service_type: bookkeeping, name: "Bank Reconciliation") }
      let(:data_entry) { ServiceTask.create!(service_type: bookkeeping, name: "Payroll Data Entry") }
      let(:business) { Client.create!(first_name: "Maria", last_name: "Santos", client_type: "business", business_name: "MoSa's") }
      let(:detail_date) { work_date + 2.days }

      let!(:july_rec) do
        create_entry(user: employee, work_date: detail_date, start_time: "08:00", end_time: "10:00", client: business,
                     service_type: bookkeeping, service_task: bank_rec, period_type: "month", period_start: Date.new(2026, 7, 1))
      end
      let!(:november_entry) do
        create_entry(user: employee, work_date: detail_date, start_time: "10:00", end_time: "11:30", client: business,
                     service_type: bookkeeping, service_task: data_entry, period_type: "month", period_start: Date.new(2026, 11, 1))
      end

      def report_for(extra = {})
        get "/api/v1/admin/hours_report",
            params: { start_date: detail_date.iso8601, end_date: detail_date.iso8601, user_id: employee.id }.merge(extra),
            headers: auth_headers_for[admin]
        expect(response).to have_http_status(:ok)
        json
      end

      it "breaks hours down by client, category, task and period" do
        breakdown = report_for[:employees].first[:work_breakdown]

        expect(breakdown.map { |row| row.values_at(:client_name, :category_name, :task_name, :period_label, :total_hours) }).to eq([
          [ "MoSa's", "Bookkeeping", "Bank Reconciliation", "July 2026", 2.0 ],
          [ "MoSa's", "Bookkeeping", "Payroll Data Entry", "November 2026", 1.5 ]
        ])
      end

      it "keeps the same task in different periods on separate rows" do
        create_entry(user: employee, work_date: detail_date, start_time: "12:00", end_time: "12:30", client: business,
                     service_type: bookkeeping, service_task: bank_rec, period_type: "month", period_start: Date.new(2026, 8, 1))
        create_entry(user: employee, work_date: detail_date, start_time: "13:00", end_time: "14:00", client: business,
                     service_type: bookkeeping, service_task: bank_rec, period_type: "quarter", period_start: Date.new(2026, 7, 1))

        rows = report_for[:employees].first[:work_breakdown].select { |row| row[:task_name] == "Bank Reconciliation" }

        expect(rows.map { |row| row.values_at(:period_label, :total_hours) }).to contain_exactly(
          [ "July 2026", 2.0 ], [ "August 2026", 0.5 ], [ "3rd Quarter 2026", 1.0 ]
        )
      end

      it "serializes the period and unified category on each entry and does not flag it uncategorized" do
        entry = report_for[:employees].first[:days].first[:entries].find { |row| row[:id] == july_rec.id }

        expect(entry).to include(category_label: "Bookkeeping", period_type: "month", period_start: "2026-07-01", period_label: "July 2026")
        expect(entry[:review_flags]).not_to include("uncategorized")
      end

      it "filters by task and period" do
        by_task = report_for(service_task_id: data_entry.id)
        expect(by_task.dig(:employees, 0, :days, 0, :entries).map { |row| row[:id] }).to eq([ november_entry.id ])

        q3_entry = create_entry(user: employee, work_date: detail_date, start_time: "13:00", end_time: "14:00", client: business,
                                service_type: bookkeeping, service_task: bank_rec, period_type: "quarter", period_start: Date.new(2026, 7, 1))
        expect(report_for(period_type: "quarter", period_start: "2026-07-01").dig(:employees, 0, :days, 0, :entries).map { |row| row[:id] }).to eq([ q3_entry.id ])

        filtered = report_for(period_type: "month", period_start: "2026-07-01")
        expect(filtered.dig(:employees, 0, :days, 0, :entries).map { |row| row[:id] }).to eq([ july_rec.id ])
        expect(filtered[:filters]).to include(period_type: "month", period_start: "2026-07-01")
      end

      it "rejects an unsupported period filter" do
        get "/api/v1/admin/hours_report",
            params: { start_date: detail_date.iso8601, end_date: detail_date.iso8601, period_type: "week" },
            headers: auth_headers_for[admin]

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "groups legacy time-category entries under their old category" do
        legacy_date = detail_date + 1.day
        create_entry(user: employee, work_date: legacy_date, start_time: "08:00", end_time: "09:00", time_category: category)

        get "/api/v1/admin/hours_report",
            params: { start_date: legacy_date.iso8601, end_date: legacy_date.iso8601, user_id: employee.id },
            headers: auth_headers_for[admin]

        row = json.dig(:employees, 0, :work_breakdown, 0)
        expect(row).to include(category_name: "Tax Prep (legacy)", legacy_category: true, task_name: "No task", period_label: "No period", client_name: "Unassigned")
        expect(json.dig(:employees, 0, :categories, 0, :name)).to eq("Tax Prep")
      end

      it "labels task and period positions in PDF rows" do
        pdf = Reports::PayrollHoursPdf.allocate

        expect(pdf.send(:work_label, { category_label: "Bookkeeping", service_task: { name: "Bank Reconciliation" }, period_label: "July 2026" }))
          .to eq("Bookkeeping / Bank Reconciliation / July 2026")
        expect(pdf.send(:work_label, { category_label: "Bookkeeping", period_label: "July 2026" })).to eq("Bookkeeping / No task / July 2026")
        expect(pdf.send(:work_label, { category_label: "Bookkeeping", service_task: { name: "July 2026" } })).to eq("Bookkeeping / July 2026")
        expect(Reports::EmployeeTimesheetPdf.allocate.send(:work_label, { period_label: "2026" })).to eq("Uncategorized / No task / 2026")
      end

      it "exports client, category, task and period columns in the detailed CSV" do
        get "/api/v1/admin/hours_report/detailed_csv",
            params: { start_date: detail_date.iso8601, end_date: detail_date.iso8601, user_id: employee.id },
            headers: auth_headers_for[admin]

        expect(response).to have_http_status(:ok)
        rows = CSV.parse(response.body, headers: true)
        expect(rows.headers).to eq([
          "Export Reference", "Employee", "Date", "Start", "End", "Break Minutes",
          "Client", "Category", "Task", "Period", "Tax Year", "Entry Method", "Regular Hours", "Overtime Hours",
          "Total Hours", "Approval Status", "Approved By", "Approved At", "Finalized", "Comments", "Entry ID", "Line"
        ])
        first = rows.find { |row| row["Task"] == "Bank Reconciliation" }
        expect(first.to_h.slice("Client", "Category", "Period")).to eq("Client" => "MoSa's", "Category" => "Bookkeeping", "Period" => "July 2026")
      end
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
      expect(rows.first["Comments"]).to start_with("'=")
      expect(rows.first["Export Reference"]).to eq(ReportExport.last.public_id)
      expect(rows.first["Client"]).to eq("Casey Client")
    end
  end
end
