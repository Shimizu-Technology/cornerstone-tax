# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("db/migrate/20261121010000_create_time_entry_allocations").to_s

# Moving reports onto work lines must not change hours per person or per day.
# The same ledger is reported (1) before the backfill (no stored lines),
# (2) after the backfill, and (3) after one entry is split across clients.
RSpec.describe "Work lines report parity" do
  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let(:monday) { Date.new(2026, 11, 16) }
  let(:alice) { create(:user, :employee, first_name: "Alice", last_name: "Able") }
  let(:bob) { create(:user, :employee, first_name: "Bob", last_name: "Baker") }
  let(:client_a) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:client_b) { Client.create!(first_name: "B", last_name: "B", client_type: "business", business_name: "Beta Co") }
  let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }
  let(:legacy) { TimeCategory.create!(name: "Tax Prep") }

  def entry(user:, date:, from:, to:, **attrs)
    create(:time_entry, { user: user, work_date: date, approval_status: "approved",
                          start_time: tz.parse("#{date.iso8601} #{from}"), end_time: tz.parse("#{date.iso8601} #{to}") }.merge(attrs))
  end

  let!(:entries) do
    [
      entry(user: alice, date: monday, from: "07:00", to: "13:00", client: client_a, service_type: bookkeeping, description: "Bank recs"),
      entry(user: alice, date: monday, from: "13:30", to: "17:30", client: nil, description: "Admin"),
      entry(user: alice, date: monday + 1, from: "08:00", to: "18:00", client: client_b, time_category: legacy),
      entry(user: alice, date: monday + 2, from: "09:00", to: "11:00", approval_status: "pending"),
      entry(user: alice, date: monday + 3, from: "09:00", to: "12:00", approval_status: "denied"),
      entry(user: bob, date: monday, from: "09:00", to: "17:00", entry_method: "clock", approval_status: nil, client: client_a),
      entry(user: bob, date: monday + 5, from: "10:00", to: "14:00", client: nil, description: "Saturday catch-up")
    ]
  end

  before do
    Setting.set("overtime_daily_threshold_hours", "8")
    Setting.set("overtime_weekly_threshold_hours", "40")
  end

  def hours_report(extra = {})
    Payroll::HoursReportBuilder.new({ start_date: monday.iso8601, end_date: (monday + 6).iso8601 }.merge(extra)).call
  end

  # The time summary does not order entries, so an edited row can come back
  # in a different position; compare entry ids as sets.
  def time_summary
    summary = Payroll::TimeSummaryBuilder.new(start_date: monday.iso8601, end_date: (monday + 6).iso8601).call.except(:generated_at)
    summary[:employees].each do |employee|
      employee[:days].each do |day|
        day[:entry_ids] = day[:entry_ids].sort
        day[:categories].each { |category| category[:entry_ids] = category[:entry_ids].sort }
        day[:categories] = day[:categories].sort_by { |category| category[:name] }
      end
    end
    summary
  end

  def totals(report)
    report[:employees].to_h do |employee|
      [ employee[:id], {
        total: employee.values_at(:total_hours, :regular_hours, :overtime_hours, :break_hours, :entries_count),
        days: employee[:days].map { |day| day.values_at(:work_date, :total_hours, :regular_hours, :overtime_hours) },
        weeks: employee[:weeks].map { |week| week.values_at(:week_start, :weekly_total_hours, :period_hours, :regular_hours, :overtime_hours) }
      } ]
    end
  end

  def client_totals(report)
    report[:employees].to_h { |employee| [ employee[:id], employee[:clients].map { |row| row.values_at(:name, :total_hours, :regular_hours, :overtime_hours) } ] }
  end

  it "reports the same per-person and per-day hours before and after the backfill and after a split" do
    TimeEntryAllocation.delete_all
    TimeEntry.find_each { |time_entry| time_entry.association(:work_lines).reset }
    before_report = hours_report
    before_summary = time_summary

    ActiveRecord::Base.connection.execute(CreateTimeEntryAllocations::BACKFILL_SQL)
    completed_with_hours = TimeEntry.where(status: "completed").where("hours > 0")
    expect(TimeEntryAllocation.count).to eq(completed_with_hours.count)
    completed_with_hours.includes(:work_lines).find_each do |time_entry|
      line = time_entry.work_lines.sole
      expect(line.attributes.slice("client_id", "service_type_id", "service_task_id", "period_type", "period_start", "description"))
        .to eq(time_entry.attributes.slice("client_id", "service_type_id", "service_task_id", "period_type", "period_start", "description"))
      expect(line.hours).to eq(time_entry.hours)
    end

    after_backfill = hours_report
    expect(totals(after_backfill)).to eq(totals(before_report))
    expect(client_totals(after_backfill)).to eq(client_totals(before_report))
    expect(after_backfill[:summary]).to eq(before_report[:summary])
    expect(time_summary).to eq(before_summary)
    # Running the backfill again changes nothing.
    expect { ActiveRecord::Base.connection.execute(CreateTimeEntryAllocations::BACKFILL_SQL) }.not_to change(TimeEntryAllocation, :count)

    # Split Alice's 6h Monday entry: 4h Alpha, 2h Beta.
    split = entries.first.reload
    split.work_lines_input = [
      { client_id: client_a.id, service_type_id: bookkeeping.id, description: "Bank recs", minutes: 240 },
      { client_id: client_b.id, description: "Credit card recs", minutes: 120 }
    ]
    split.save!

    after_split = hours_report
    expect(totals(after_split)).to eq(totals(before_report))
    expect(after_split[:summary]).to eq(before_report[:summary])
    expect(time_summary).to eq(before_summary)

    alice_clients = after_split[:employees].find { |employee| employee[:id] == alice.id }[:clients]
    expect(alice_clients.map { |row| row.values_at(:name, :total_hours) }).to contain_exactly(
      [ "Alpha Co", 4.0 ], [ "Beta Co", 12.0 ], [ "Unassigned", 4.0 ]
    )
  end

  it "filters by client per line and splits overtime regular-first in line order" do
    split = entries.third # Alice, 10h, 8 regular + 2 overtime
    split.work_lines_input = [ { client_id: client_b.id, minutes: 420 }, { client_id: client_a.id, minutes: 180 } ]
    split.save!

    report = hours_report(client_id: client_a.id.to_s, user_id: alice.id)
    day = report[:employees].first[:days].find { |row| row[:work_date] == (monday + 1).iso8601 }
    expect(day.values_at(:total_hours, :regular_hours, :overtime_hours)).to eq([ 3.0, 1.0, 2.0 ])
    expect(day[:entries].first[:work_lines].map { |line| line[:client_label] }).to eq([ "Alpha Co" ])
    expect(day[:entries].first[:entry_total_hours]).to eq(10.0)
  end
  it "counts an entry's break once, in the group of its first line, whatever order the groups come in" do
    TimeEntry.delete_all
    # Entries sort by start time; the Beta-only entry must come first for the
    # Beta group to be built before the Alpha group.
    entry(user: alice, date: monday, from: "10:00", to: "11:00", client: client_b, break_minutes: 30)
    split = entry(user: alice, date: monday, from: "11:30", to: "15:30", break_minutes: 60)
    split.work_lines_input = [ { client_id: client_a.id, minutes: 60 }, { client_id: client_b.id, minutes: 120 } ]
    split.save!

    clients = hours_report(user_id: alice.id)[:employees].first[:clients].to_h { |row| [ row[:name], row[:break_hours] ] }
    expect(clients).to eq("Alpha Co" => 1.0, "Beta Co" => 0.5)
  end
end
