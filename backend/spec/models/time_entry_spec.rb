# frozen_string_literal: true

require "rails_helper"

RSpec.describe TimeEntry, type: :model do
  let(:user) { create(:user, :employee) }

  def build_entry(**attrs)
    build(:time_entry, user: user, **attrs)
  end

  describe "work period" do
    it "is optional" do
      entry = build_entry(period_type: nil, period_start: nil)

      expect(entry).to be_valid
      expect(entry.period_label).to be_nil
    end

    it "treats blank strings as no period" do
      entry = build_entry(period_type: "", period_start: "")

      expect(entry).to be_valid
      expect(entry.period_type).to be_nil
      expect(entry.period_start).to be_nil
    end

    it "requires the type and start together" do
      missing_start = build_entry(period_type: "month", period_start: nil)
      missing_type = build_entry(period_type: nil, period_start: Date.new(2026, 7, 1))

      expect(missing_start).not_to be_valid
      expect(missing_start.errors[:period_start]).to include("and period type must both be set or both be blank")
      expect(missing_type).not_to be_valid
    end

    it "rejects unsupported period types" do
      entry = build_entry(period_type: "week", period_start: Date.new(2026, 7, 1))

      expect(entry).not_to be_valid
      expect(entry.errors[:period_type]).to be_present
    end

    it "requires the start to be the first day of the month" do
      expect(build_entry(period_type: "month", period_start: Date.new(2026, 7, 1))).to be_valid

      entry = build_entry(period_type: "month", period_start: Date.new(2026, 7, 15))
      expect(entry).not_to be_valid
      expect(entry.errors[:period_start]).to include("must be the first day of the selected month")
    end

    it "requires a quarter to start in January, April, July or October" do
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 10, 1))).to be_valid
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 8, 1))).not_to be_valid
    end

    it "requires a year to start on January 1" do
      expect(build_entry(period_type: "year", period_start: Date.new(2026, 1, 1))).to be_valid
      expect(build_entry(period_type: "year", period_start: Date.new(2026, 7, 1))).not_to be_valid
    end

    it "labels months, quarters and years the way staff read them" do
      expect(build_entry(period_type: "month", period_start: Date.new(2026, 7, 1)).period_label).to eq("July 2026")
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 1, 1)).period_label).to eq("1st Quarter 2026")
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 4, 1)).period_label).to eq("2nd Quarter 2026")
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 7, 1)).period_label).to eq("3rd Quarter 2026")
      expect(build_entry(period_type: "quarter", period_start: Date.new(2026, 10, 1)).period_label).to eq("4th Quarter 2026")
      expect(build_entry(period_type: "year", period_start: Date.new(2026, 1, 1)).period_label).to eq("2026")
    end

    it "is also enforced by the database" do
      entry = create(:time_entry, user: user)

      expect {
        entry.update_columns(period_type: "month", period_start: nil)
      }.to raise_error(ActiveRecord::StatementInvalid, /check_time_entries_period_pair/)
    end

    it "has the database reject misaligned periods that bypass validation" do
      entry = create(:time_entry, user: user)
      write = lambda do |type, start|
        TimeEntry.transaction(requires_new: true) { entry.update_columns(period_type: type, period_start: start) }
      end

      expect { write.call("quarter", Date.new(2026, 8, 1)) }.to raise_error(ActiveRecord::StatementInvalid, /check_time_entries_period_alignment/)
      expect { write.call("year", Date.new(2026, 7, 1)) }.to raise_error(ActiveRecord::StatementInvalid, /check_time_entries_period_alignment/)
      expect { write.call("month", Date.new(2026, 7, 2)) }.to raise_error(ActiveRecord::StatementInvalid, /check_time_entries_period_alignment/)
      expect { write.call("quarter", Date.new(2026, 10, 1)) }.not_to raise_error
    end

    it "rejects a period start that is not a date instead of raising" do
      entry = build_entry(period_type: "month", period_start: 123)

      expect(entry).not_to be_valid
      expect(entry.errors[:period_start]).to include("must be a valid date (YYYY-MM-DD)")
    end

    it "rejects a malformed period start instead of dropping it" do
      entry = build_entry(period_type: nil, period_start: "not-a-date")

      expect(entry).not_to be_valid
      expect(entry.errors[:period_start]).to include("must be a valid date (YYYY-MM-DD)")
    end
  end

  describe "#category_label" do
    let(:service_type) { ServiceType.create!(name: "Bookkeeping") }
    let(:legacy_category) { TimeCategory.create!(name: "Tax Prep") }

    it "uses the category (service type) when present" do
      expect(build_entry(service_type: service_type, time_category: legacy_category).category_label).to eq("Bookkeeping")
    end

    it "marks a legacy time category" do
      expect(build_entry(time_category: legacy_category).category_label).to eq("Tax Prep (legacy)")
    end

    it "is nil for uncategorized work" do
      expect(build_entry.category_label).to be_nil
    end
  end

  describe "selected work records" do
    it "reports a client that no longer exists as a validation error" do
      entry = build_entry(client_id: Client.maximum(:id).to_i + 1000)

      expect(entry).not_to be_valid
      expect(entry.errors[:client]).to include("no longer exists")
    end
  end

  describe "service task" do
    it "still has to belong to the selected category" do
      bookkeeping = ServiceType.create!(name: "Bookkeeping")
      payroll = ServiceType.create!(name: "Payroll")
      task = ServiceTask.create!(service_type: payroll, name: "Payroll Processing")

      entry = build_entry(service_type: bookkeeping, service_task: task)

      expect(entry).not_to be_valid
      expect(entry.errors[:service_task]).to include("must belong to the selected service type")
    end
  end
end
