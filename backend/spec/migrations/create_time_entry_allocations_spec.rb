# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("db/migrate/20261121010000_create_time_entry_allocations").to_s

# Runs the real migration down (and back up) inside the example's
# transaction; PostgreSQL DDL is transactional, so the schema is restored.
RSpec.describe CreateTimeEntryAllocations do
  let(:migration) { described_class.new }
  let(:user) { create(:user, :employee) }
  let(:alpha) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:beta) { Client.create!(first_name: "B", last_name: "B", client_type: "business", business_name: "Beta Co") }
  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }

  def quietly(&block)
    ActiveRecord::Migration.suppress_messages(&block)
  end

  def entry(**attrs)
    create(:time_entry, { user: user, work_date: Date.new(2026, 11, 16), approval_status: "approved",
                          start_time: tz.parse("2026-11-16 08:00"), end_time: tz.parse("2026-11-16 12:07") }.merge(attrs))
  end

  after { TimeEntryAllocation.reset_column_information }

  it "refuses to roll back once an entry is split across clients" do
    split = entry(client: alpha)
    split.work_lines_input = [ { client_id: alpha.id, hours: "2.00" }, { client_id: beta.id, hours: "2.12" } ]
    split.save!
    expect(split.reload.hours).to eq(BigDecimal("4.12"))

    expect { quietly { migration.down } }
      .to raise_error(ActiveRecord::IrreversibleMigration, /1 time entry has work lines.*Entry ids: #{split.id}\..*TIME_ENTRY_WORK_LINES_ROLLBACK/m)
    expect(ActiveRecord::Base.connection.table_exists?(:time_entry_allocations)).to be(true)
    expect(split.work_lines.reload.map { |line| line.hours.to_f }).to eq([ 2.0, 2.12 ])
  end

  it "refuses when a single line differs from its entry" do
    drifted = entry(client: alpha, description: "Bank recs")
    drifted.work_lines.first.update_columns(client_id: beta.id)

    expect { quietly { migration.down } }.to raise_error(ActiveRecord::IrreversibleMigration, /Entry ids: #{drifted.id}\./)
  end

  it "rolls back and re-applies losslessly when every entry has one matching line" do
    one = entry(client: alpha, description: "Bank recs")
    edited = entry(client: nil, description: "Admin")
    edited.work_lines_input = [ { client_id: beta.id, description: "Payroll inputs", minutes: 247 } ]
    edited.save!

    quietly { migration.down }
    expect(ActiveRecord::Base.connection.table_exists?(:time_entry_allocations)).to be(false)

    quietly { migration.up }
    TimeEntryAllocation.reset_column_information
    expect(TimeEntryAllocation.where(time_entry_id: one.id).pluck(:client_id, :description, :hours)).to eq([ [ alpha.id, "Bank recs", BigDecimal("4.12") ] ])
    expect(TimeEntryAllocation.where(time_entry_id: edited.id).pluck(:client_id, :description, :hours)).to eq([ [ beta.id, "Payroll inputs", BigDecimal("4.12") ] ])
  end
end
