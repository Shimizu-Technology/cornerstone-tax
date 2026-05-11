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
end
