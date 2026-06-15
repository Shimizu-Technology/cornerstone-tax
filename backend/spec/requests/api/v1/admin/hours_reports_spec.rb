# frozen_string_literal: true

require "rails_helper"

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
  end
end
