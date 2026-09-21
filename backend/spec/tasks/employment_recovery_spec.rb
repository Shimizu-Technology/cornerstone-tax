# frozen_string_literal: true

require "rails_helper"
require "rake"

RSpec.describe "employment:recover_legacy_deleted_employee" do
  let(:task) { Rake::Task["employment:recover_legacy_deleted_employee"] }

  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("employment:recover_legacy_deleted_employee")
  end

  around do |example|
    original = ENV.to_h.slice(
      "EMAIL", "CLERK_ID", "FIRST_NAME", "LAST_NAME", "TIME_ENTRY_IDS", "SCHEDULE_IDS",
      "EXPECTED_HOURS", "TERMINATION_EFFECTIVE_ON", "TERMINATION_REASON", "APPLY"
    )
    example.run
  ensure
    %w[
      EMAIL CLERK_ID FIRST_NAME LAST_NAME TIME_ENTRY_IDS SCHEDULE_IDS EXPECTED_HOURS
      TERMINATION_EFFECTIVE_ON TERMINATION_REASON APPLY
    ].each { |key| ENV.delete(key) }
    original.each { |key, value| ENV[key] = value }
    task.reenable
  end

  it "dry-runs before atomically restoring a terminated profile and its explicit history" do
    entry = create(:time_entry, user: nil, hours: 8.0)
    schedule = Schedule.create!(
      user: nil,
      work_date: entry.work_date,
      start_time: Time.utc(2000, 1, 1, 9),
      end_time: Time.utc(2000, 1, 1, 17)
    )
    ENV.update(
      "EMAIL" => "legacy.employee@example.com",
      "CLERK_ID" => "user_legacy_employee",
      "FIRST_NAME" => "Legacy",
      "LAST_NAME" => "Employee",
      "TIME_ENTRY_IDS" => entry.id.to_s,
      "SCHEDULE_IDS" => schedule.id.to_s,
      "EXPECTED_HOURS" => "8.0"
    )

    expect { task.invoke }.to output(/DRY RUN.*No changes made/m).to_stdout
    expect(User.find_by(email: ENV.fetch("EMAIL"))).to be_nil
    expect(entry.reload.user).to be_nil

    task.reenable
    ENV["APPLY"] = "true"
    expect { task.invoke }.to output(/APPLY.*Recovery complete/m).to_stdout

    employee = User.find_by!(email: ENV.fetch("EMAIL"))
    expect(employee).to be_terminated
    expect(employee.termination_effective_on).to be_nil
    expect(entry.reload.user).to eq(employee)
    expect(schedule.reload.user).to eq(employee)
  end

  it "refuses an existing profile unless email and Clerk ID identify the same employee" do
    existing = create(:user, :employee, email: "legacy.employee@example.com", clerk_id: "different_clerk_id")
    existing.terminate!(by: create(:user, :admin))
    entry = create(:time_entry, user: nil, hours: 8.0)
    schedule = Schedule.create!(
      user: nil,
      work_date: entry.work_date,
      start_time: Time.utc(2000, 1, 1, 9),
      end_time: Time.utc(2000, 1, 1, 17)
    )
    ENV.update(
      "EMAIL" => existing.email,
      "CLERK_ID" => "authoritative_clerk_id",
      "FIRST_NAME" => "Legacy",
      "LAST_NAME" => "Employee",
      "TIME_ENTRY_IDS" => entry.id.to_s,
      "SCHEDULE_IDS" => schedule.id.to_s,
      "EXPECTED_HOURS" => "8.0"
    )

    expect { task.invoke }
      .to raise_error(SystemExit)
      .and output(/EMAIL and CLERK_ID must resolve to the same existing user/).to_stderr

    expect(entry.reload.user).to be_nil
  end
end
