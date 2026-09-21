# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Schedules", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee) }
  let(:terminated_employee) { create(:user, :employee) }
  let(:headers) { { "Authorization" => "Bearer test_token_#{admin.id}" } }

  before do
    terminated_employee.terminate!(by: admin)
  end

  it "does not create a schedule for a terminated employee" do
    post "/api/v1/schedules",
         params: {
           schedule: {
             user_id: terminated_employee.id,
             work_date: Date.current.iso8601,
             start_time: "09:00",
             end_time: "17:00"
           }
         },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)["error"]).to eq("Selected user is not an active staff member")
  end

  it "does not reassign an existing schedule to a terminated employee" do
    schedule = Schedule.create!(
      user: employee,
      work_date: Date.current,
      start_time: Time.utc(2000, 1, 1, 9),
      end_time: Time.utc(2000, 1, 1, 17)
    )

    patch "/api/v1/schedules/#{schedule.id}",
          params: { schedule: { user_id: terminated_employee.id } },
          headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(schedule.reload.user).to eq(employee)
  end

  it "keeps historical schedules visible while omitting terminated staff from scheduling choices" do
    historical_schedule = Schedule.create!(
      user: terminated_employee,
      work_date: Date.current,
      start_time: Time.utc(2000, 1, 1, 9),
      end_time: Time.utc(2000, 1, 1, 17)
    )

    get "/api/v1/schedules", params: { week: Date.current.beginning_of_week(:sunday).iso8601 }, headers: headers

    body = JSON.parse(response.body)
    row = body["schedules"].find { |schedule| schedule["id"] == historical_schedule.id }
    expect(row.dig("user", "employment_status")).to eq("terminated")
    expect(body["users"].map { |user| user["id"] }).not_to include(terminated_employee.id)
  end
end
