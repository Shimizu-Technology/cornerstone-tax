# frozen_string_literal: true

require "rails_helper"

RSpec.describe "TimeEntry work lines" do
  let(:user) { create(:user, :employee) }
  let(:client_a) { Client.create!(first_name: "Ana", last_name: "Alpha", client_type: "business", business_name: "Alpha Co") }
  let(:client_b) { Client.create!(first_name: "Ben", last_name: "Beta", client_type: "business", business_name: "Beta Co") }
  let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }
  let(:bank_rec) { ServiceTask.create!(service_type: bookkeeping, name: "Bank Reconciliation") }
  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }

  def manual_entry(**attrs)
    build(:time_entry, { user: user, entry_method: "manual", approval_status: "approved",
                         start_time: tz.parse("2026-11-16 09:00"), end_time: tz.parse("2026-11-16 12:00"),
                         work_date: Date.new(2026, 11, 16) }.merge(attrs))
  end

  it "keeps one line that follows the entry's work fields and hours when no lines are sent" do
    entry = manual_entry(client: client_a, service_type: bookkeeping, service_task: bank_rec, description: "Bank rec")
    entry.save!

    expect(entry.work_lines.count).to eq(1)
    expect(entry.work_lines.first).to have_attributes(client_id: client_a.id, service_task_id: bank_rec.id, hours: 3, description: "Bank rec")

    entry.update!(client: client_b, end_time: tz.parse("2026-11-16 13:00"))
    expect(entry.work_lines.reload.map { |line| [ line.client_id, line.hours.to_f ] }).to eq([ [ client_b.id, 4.0 ] ])
  end

  it "stores minute lines as two-decimal hours that add up to the entry" do
    entry = manual_entry(end_time: tz.parse("2026-11-16 10:00"))
    entry.work_lines_input = [
      { client_id: client_a.id, description: "Bank rec", minutes: 20 },
      { client_id: client_b.id, description: "Credit cards", duration: "20m" },
      { client_id: nil, description: "Weekly meeting", hours: "0.333333" }
    ]
    entry.save!

    lines = entry.work_lines.reload
    expect(lines.map { |line| line.hours.to_f }).to eq([ 0.33, 0.34, 0.33 ])
    expect(lines.sum(&:hours)).to eq(entry.hours)
    expect(lines.map(&:minutes)).to eq([ 20, 20, 20 ])
    # Entry-level columns mirror the first line; descriptions are combined.
    expect(entry).to have_attributes(client_id: client_a.id, description: "Bank rec; Credit cards; Weekly meeting")
  end

  it "rejects lines that do not add up to the entry" do
    entry = manual_entry
    entry.work_lines_input = [ { client_id: client_a.id, minutes: 60 }, { client_id: client_b.id, minutes: 60 } ]

    expect(entry.save).to be(false)
    expect(entry.errors.full_messages.to_sentence).to include("Work lines add up to 2h, short of this entry's 3h by 1h")
  end

  it "computes a manual day log's hours from its lines when no times are given" do
    entry = manual_entry(start_time: nil, end_time: nil)
    entry.work_lines_input = [ { client_id: client_a.id, description: "Prepared bank reconciliations", minutes: 45 },
                               { client_id: client_b.id, description: "Reconciled cc accounts", duration: "1.5h" } ]
    entry.save!

    expect(entry.reload.hours).to eq(BigDecimal("2.25"))
    expect(entry).to be_duration_only
  end

  it "requires lines on a manual entry without times" do
    entry = manual_entry(start_time: nil, end_time: nil, hours: 2)
    expect(entry.save).to be(false)
    expect(entry.errors.full_messages).to include("Add work lines or start and end times")
  end

  it "protects a split entry from entry-level edits that would desync its lines" do
    entry = manual_entry
    entry.work_lines_input = [ { client_id: client_a.id, minutes: 120 }, { client_id: client_b.id, minutes: 60 } ]
    entry.save!

    expect(entry.update(client: client_b)).to be(false)
    expect(entry.errors.full_messages.to_sentence).to include("split across several work lines")

    entry.reload
    expect(entry.update(end_time: tz.parse("2026-11-16 13:00"))).to be(false)
    expect(entry.errors.full_messages.to_sentence).to include("Work lines add up to 3.00h but this entry is 4.00h")

    # Approval and other attendance changes leave the lines untouched.
    entry.reload
    entry.update!(approval_note: "checked")
    expect(entry.work_lines.reload.size).to eq(2)
  end

  it "rejects a task without a category and a task from another category" do
    other = ServiceType.create!(name: "Payroll")
    entry = manual_entry
    entry.work_lines_input = [ { client_id: client_a.id, service_type_id: other.id, service_task_id: bank_rec.id, minutes: 180 } ]

    expect(entry.save).to be(false)
    expect(entry.errors.full_messages.to_sentence).to include("must belong to the selected category")
  end

  it "keeps no lines on open clocks and zero-hour entries" do
    entry = TimeEntry.create!(user: user, work_date: Date.current, start_time: Time.current, clock_in_at: Time.current,
                              entry_method: "clock", status: "clocked_in", hours: 0)
    expect(entry.work_lines).to be_empty
  end
end
