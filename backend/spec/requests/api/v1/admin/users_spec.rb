# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Users", type: :request do
  let(:admin) { create(:user, :admin, first_name: "Dafne") }
  let(:employee) { create(:user, :employee, first_name: "Daena", last_name: "Mansapit") }
  let(:headers) { { "Authorization" => "Bearer test_token_#{admin.id}" } }

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  describe "POST /api/v1/admin/users/:id/terminate" do
    it "ends access while retaining the profile and historical records" do
      entry = create(:time_entry, user: employee, hours: 7.5)
      schedule = Schedule.create!(user: employee, work_date: Date.current, start_time: Time.utc(2000, 1, 1, 9), end_time: Time.utc(2000, 1, 1, 17))

      post "/api/v1/admin/users/#{employee.id}/terminate",
           params: { termination_effective_on: Date.current.iso8601, termination_reason: "Employment ended" },
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(employee.reload).to be_terminated
      expect(entry.reload.user).to eq(employee)
      expect(schedule.reload.user).to eq(employee)
      expect(json.dig(:user, :time_entries_count)).to eq(1)
      expect(json.dig(:user, :schedules_count)).to eq(1)
      expect(AuditLog.where(auditable: employee, action: "updated").last.metadata).to include("historical records retained")
    end

    it "does not allow an administrator to terminate their own account" do
      post "/api/v1/admin/users/#{admin.id}/terminate", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload).to be_employment_active
    end

    it "rolls back the lifecycle change when its audit record cannot be written" do
      allow(AuditLog).to receive(:log).and_raise("audit unavailable")

      post "/api/v1/admin/users/#{employee.id}/terminate", headers: headers

      expect(response).to have_http_status(:internal_server_error)
      expect(employee.reload).to be_employment_active
    end
  end

  describe "POST /api/v1/admin/users/:id/reactivate" do
    it "restores access eligibility without replacing the profile" do
      employee.terminate!(by: admin, reason: "Temporary")

      post "/api/v1/admin/users/#{employee.id}/reactivate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(employee.reload).to be_employment_active
      expect(json.dig(:user, :employment_status)).to eq("active")
    end
  end

  describe "GET /api/v1/admin/users" do
    it "keeps terminated people visible with their history counts" do
      create_list(:time_entry, 2, user: employee)
      employee.terminate!(by: admin)

      get "/api/v1/admin/users", headers: headers

      row = json[:users].find { |user| user[:id] == employee.id }
      expect(row[:employment_status]).to eq("terminated")
      expect(row[:time_entries_count]).to eq(2)
    end
  end

  describe "GET /api/v1/users" do
    it "excludes terminated staff from operational lists but lets admins request reporting history" do
      active = create(:user, :employee)
      employee.terminate!(by: admin)

      get "/api/v1/users", headers: headers
      expect(json[:users].map { |user| user[:id] }).to contain_exactly(admin.id, active.id)

      get "/api/v1/users", params: { include_terminated: true }, headers: headers
      expect(json[:users].map { |user| user[:id] }).to contain_exactly(admin.id, active.id, employee.id)
    end
  end
end
