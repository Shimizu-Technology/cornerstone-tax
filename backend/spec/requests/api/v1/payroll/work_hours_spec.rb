# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Payroll::WorkHours", type: :request do
  let(:secret) { "spec-work-hours-secret" }

  # Signs like Payroll will (docs/PAYROLL_WORK_HOURS_FEED.md).
  def signature_headers(query_string, at: Time.current, key: secret, method: "GET", path: "/api/v1/payroll/work_hours")
    timestamp = at.to_i.to_s
    {
      "X-Work-Hours-Timestamp" => timestamp,
      "X-Work-Hours-Signature" => Payroll::WorkHoursSignature.sign(secret: key, method: method, path: path, query_string: query_string, timestamp: timestamp)
    }
  end

  def signed_get(params, **options)
    query = params.to_query
    get "/api/v1/payroll/work_hours?#{query}", headers: signature_headers(query, **options)
  end
  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let(:monday) { Date.new(2026, 11, 16) }
  let(:alice) { create(:user, :employee, email: "alice@example.test") }
  let(:bob) { create(:user, :employee, email: "bob@example.test") }
  let!(:internal) { Client.ensure_internal! }
  let(:alpha) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:beta) { Client.create!(first_name: "B", last_name: "B", client_type: "business", business_name: "Beta Co") }
  let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }
  let(:bank_rec) { ServiceTask.create!(service_type: bookkeeping, name: "Bank reconciliation") }
  let(:office) { ServiceType.create!(name: "Office & errands", internal: true) }

  around do |example|
    previous = ENV.to_h.slice("PAYROLL_WORK_HOURS_SECRET", "PAYROLL_SHARED_SECRET")
    ENV["PAYROLL_WORK_HOURS_SECRET"] = secret
    ENV["PAYROLL_SHARED_SECRET"] = "spec-time-summary-secret"
    example.run
  ensure
    %w[PAYROLL_WORK_HOURS_SECRET PAYROLL_SHARED_SECRET].each { |key| ENV[key] = previous[key] }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def entry(user, date, from, to, lines: nil, **attrs)
    record = TimeEntry.new({ user: user, work_date: date, entry_method: "manual", approval_status: "approved",
                             start_time: tz.parse("#{date} #{from}"), end_time: tz.parse("#{date} #{to}") }.merge(attrs))
    record.work_lines_input = lines if lines
    record.save!
    record
  end

  let!(:split) do
    entry(alice, monday, "08:00", "12:00", lines: [
      { client_id: alpha.id, service_type_id: bookkeeping.id, service_task_id: bank_rec.id, period_type: "month", period_start: "2026-10-01", description: "Oct bank rec", minutes: 150 },
      { client_id: internal.id, service_type_id: office.id, description: "Post office", minutes: 30 },
      { client_id: nil, description: "Misc", minutes: 60 }
    ])
  end
  let!(:same_group) do
    entry(alice, monday, "13:00", "14:00", lines: [
      { client_id: alpha.id, service_type_id: bookkeeping.id, service_task_id: bank_rec.id, period_type: "month", period_start: "2026-10-01", description: "More rec", minutes: 60 }
    ])
  end
  let!(:clock) { entry(bob, monday, "09:00", "17:00", entry_method: "clock", approval_status: nil, client: beta) }
  let!(:pending) { entry(alice, monday + 1, "09:00", "11:00", approval_status: "pending", client: beta) }
  let!(:denied) { entry(alice, monday + 1, "13:00", "14:00", approval_status: "denied", client: beta) }
  let!(:open_clock) do
    TimeEntry.create!(user: bob, work_date: monday + 2, entry_method: "clock", status: "clocked_in", hours: 0,
                      start_time: tz.parse("#{monday + 2} 09:00"), clock_in_at: tz.parse("#{monday + 2} 09:00"))
  end

  let(:range) { { start: monday.iso8601, end: (monday + 6).iso8601 } }

  describe "authentication (HMAC-SHA256 request signature)" do
    it "accepts a correctly signed request" do
      signed_get(range)
      expect(response).to have_http_status(:ok)
    end

    it "accepts the query in any order and percent-encoding" do
      query = "end=#{range[:end]}&start=#{range[:start]}"
      get "/api/v1/payroll/work_hours?#{query.sub('-', '%2D')}", headers: signature_headers("start=#{range[:start]}&end=#{range[:end]}")
      expect(response).to have_http_status(:ok)
    end

    it "rejects a bad signature" do
      signed_get(range, key: "not-the-secret")
      expect(response).to have_http_status(:unauthorized)
      expect(json[:error]).to include("signature does not match")
    end

    it "rejects a request outside the 5-minute window, either way" do
      signed_get(range, at: 6.minutes.ago)
      expect(response).to have_http_status(:unauthorized)
      expect(json[:error]).to include("5-minute window")

      signed_get(range, at: 6.minutes.from_now)
      expect(response).to have_http_status(:unauthorized)

      signed_get(range, at: 4.minutes.ago)
      expect(response).to have_http_status(:ok)
    end

    it "rejects a tampered query" do
      signed = signature_headers(range.to_query)
      get "/api/v1/payroll/work_hours?#{range.merge(end: (monday + 30).iso8601).to_query}", headers: signed
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects missing headers and the old raw-secret header" do
      get "/api/v1/payroll/work_hours?#{range.to_query}"
      expect(response).to have_http_status(:unauthorized)
      expect(json[:error]).to include("missing X-Work-Hours-Timestamp")

      get "/api/v1/payroll/work_hours?#{range.to_query}", headers: { "X-Work-Hours-Secret" => secret }
      expect(response).to have_http_status(:unauthorized)
    end

    it "compares signatures in constant time" do
      expect(ActiveSupport::SecurityUtils).to receive(:secure_compare).and_call_original
      signed_get(range)
      expect(response).to have_http_status(:ok)
    end

    it "does not accept the time summary's secret" do
      signed_get(range, key: "spec-time-summary-secret")
      expect(response).to have_http_status(:unauthorized)
    end

    it "accepts a request signed with the documented Ruby signer" do
      doc = Rails.root.join("../docs/PAYROLL_WORK_HOURS_FEED.md").read
      snippet = doc[/```ruby\n(.*?)```/m, 1]
      # Defines WorkHoursSigner exactly as Payroll would copy it.
      Object.class_eval(snippet) unless defined?(WorkHoursSigner)

      uri, signed_headers = WorkHoursSigner.signed(secret: secret, query: { start: range[:start], end: range[:end] })
      get uri, headers: signed_headers
      expect(response).to have_http_status(:ok)
      expect(json[:schema_version]).to eq("1.0")
    end

    it "is unavailable when the secret is not configured" do
      ENV["PAYROLL_WORK_HOURS_SECRET"] = ""
      signed_get(range)
      expect(response).to have_http_status(:service_unavailable)
    end
  end

  it "returns hours by person, date, client, category, task and period with entry ids and approval state" do
    signed_get(range)

    expect(response).to have_http_status(:ok)
    expect(json).to include(schema_version: "1.0", source: "cornerstone_tax", start_date: "2026-11-16", end_date: "2026-11-22")
    alpha_row = json[:rows].find { |row| row[:client_id] == alpha.id }
    expect(alpha_row).to include(
      tax_user_id: alice.id, email: "alice@example.test", work_date: "2026-11-16", client_name: "Alpha Co", system_kind: nil,
      category: "Bookkeeping", task: "Bank reconciliation", period_type: "month", period_start: "2026-10-01", period_label: "October 2026",
      hours: 3.5, minutes: 210, entry_ids: [ split.id, same_group.id ].sort, approval_state: "approved"
    )
    expect(json[:rows].find { |row| row[:client_id] == internal.id }).to include(system_kind: "internal", category: "Office & errands", hours: 0.5)
    expect(json[:rows].find { |row| row[:unassigned] && row[:tax_user_id] == alice.id && row[:work_date] == "2026-11-16" })
      .to include(client_id: nil, client_name: "Unassigned", hours: 1.0, entry_ids: [ split.id ])
    expect(json[:rows].find { |row| row[:tax_user_id] == bob.id }).to include(client_name: "Beta Co", hours: 8.0, approval_state: "clock")
    expect(json[:rows].find { |row| row[:entry_ids] == [ pending.id ] }).to include(approval_state: "pending", hours: 2.0)
    expect(json[:rows].flat_map { |row| row[:entry_ids] }).not_to include(denied.id, open_clock.id)
  end

  it "counts pending, denied and open-clock entries, per person and overall" do
    signed_get(range)

    expect(json[:counts]).to include(pending_entries: 1, denied_entries: 1, open_clock_entries: 1)
    expect(json.dig(:counts, :by_user).find { |row| row[:tax_user_id] == bob.id }).to include(open_clock_entries: 1, pending_entries: 0)
  end

  it "has per-day countable totals that match the payroll time summary" do
    signed_get(range)
    day_totals = json[:day_totals].to_h { |row| [ [ row[:tax_user_id], row[:work_date] ], row ] }

    summary = Payroll::TimeSummaryBuilder.new(start_date: range[:start], end_date: range[:end]).call
    summary[:employees].each do |employee|
      employee[:days].each do |day|
        total = day_totals[[ employee[:source_user_id].to_i, day[:work_date] ]]
        expect(total ? total[:countable_hours] : 0.0).to eq(day[:hours])
      end
    end
    expect(day_totals[[ alice.id, "2026-11-17" ]]).to include(countable_hours: 0.0, pending_hours: 2.0)
    expect(day_totals[[ alice.id, "2026-11-16" ]]).to include(countable_hours: 5.0, unassigned_hours: 1.0)

    # Rows add up to the day totals (countable + pending).
    json[:day_totals].each do |total|
      rows = json[:rows].select { |row| row[:tax_user_id] == total[:tax_user_id] && row[:work_date] == total[:work_date] }
      expect(rows.sum { |row| row[:hours] }.round(2)).to eq((total[:countable_hours] + total[:pending_hours]).round(2))
    end
  end

  it "does not lock entries or record a payroll export" do
    expect do
      signed_get(range)
    end.not_to change(ReportExport, :count)
    expect(ReportExport.active_for_entry(split.id)).to be_empty
    expect(split.reload.locked_at).to be_nil
  end

  it "never includes pay, rates, SSNs or bank data" do
    signed_get(range)
    keys = json[:rows].flat_map(&:keys).uniq.map(&:to_s)
    expect(keys).to contain_exactly(*%w[tax_user_id email work_date client_id client_name system_kind unassigned category_id category
                                        task_id task period_type period_start period_label hours minutes entry_ids approval_state])
    all_keys = ->(value) { value.is_a?(Hash) ? value.flat_map { |key, inner| [ key.to_s ] + all_keys.(inner) } : value.is_a?(Array) ? value.flat_map { |inner| all_keys.(inner) } : [] }
    expect(all_keys.(json).uniq.grep(/(\A|_)(rate|pay|salary|wage|ssn|social|bank|routing|account)/i)).to be_empty
  end

  it "validates the range" do
    signed_get({ start: "2026-11-20", end: "2026-11-01" })
    expect(response).to have_http_status(:unprocessable_entity)
    signed_get({ start: "2026-01-01", end: "2026-06-01" })
    expect(json[:error]).to include("may not exceed 62 days")
  end
end
