# frozen_string_literal: true

require "rails_helper"

RSpec.describe TaxReturn, type: :model do
  let(:client) do
    Client.create!(
      first_name: "Tax",
      last_name: "Client",
      email: "tax-client@example.com"
    )
  end

  it "does not log operational default changes when a return is created" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    expect(tax_return.workflow_events.where(event_type: %w[payment_updated filing_updated portal_updated])).to be_empty
  end

  it "logs operational changes after creation" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(payment_status: "paid", filing_status: "filed_irs", portal_visible: true)

    expect(tax_return.workflow_events.pluck(:event_type)).to include(
      "payment_updated",
      "filing_updated",
      "portal_updated"
    )
  end

  it "records changed payment fields in payment audit values" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(base_fee_cents: 50_000, discount_reason: "CEO discount")

    event = tax_return.workflow_events.find_by!(event_type: "payment_updated")
    expect(event.old_value).to eq("base_fee_cents: 0; discount_reason: none")
    expect(event.new_value).to eq("base_fee_cents: 50000; discount_reason: CEO discount")
    expect(event.description).to include("base_fee_cents", "discount_reason")
  end

  it "records changed filing fields in filing audit values" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(drt_confirmation: "DRT-123")

    event = tax_return.workflow_events.find_by!(event_type: "filing_updated")
    expect(event.old_value).to eq("drt_confirmation: none")
    expect(event.new_value).to eq("drt_confirmation: DRT-123")
  end

  it "records changed portal fields in portal audit values" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(documents_enabled: false)

    event = tax_return.workflow_events.find_by!(event_type: "portal_updated")
    expect(event.old_value).to eq("documents_enabled: true")
    expect(event.new_value).to eq("documents_enabled: false")
  end

  it "returns a validation error instead of raising when filing status is nil" do
    tax_return = described_class.new(client: client, tax_year: 2026, filing_status: nil)

    expect { tax_return.valid? }.not_to raise_error
    expect(tax_return.errors[:filing_status]).to be_present
  end

  it "sets filed_at when a return is marked paper filed" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(filing_status: "paper_filed")

    expect(tax_return.filed_at).to be_present
  end
end
