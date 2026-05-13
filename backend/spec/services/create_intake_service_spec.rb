# frozen_string_literal: true

require "rails_helper"

RSpec.describe CreateIntakeService do
  let!(:stage) { WorkflowStage.create!(name: "Intake Received", slug: "intake_received", position: 1) }

  it "stores only allowlisted intake fields in the submission snapshot" do
    result = described_class.call(
      first_name: "Snapshot",
      last_name: "Client",
      date_of_birth: "1990-01-01",
      email: "snapshot-client@example.com",
      phone: "671-555-0100",
      mailing_address: "123 Test Street",
      filing_status: "single",
      tax_year: 2026,
      bank_routing_number: "123456789",
      bank_account_number: "987654321",
      ssn: "111-22-3333",
      itin: "999-88-7777",
      dependents: [
        {
          name: "Dependent",
          relationship: "Child"
        }
      ],
      income_sources: [
        {
          source_type: "w2",
          payer_name: "Employer"
        }
      ]
    )

    payload = result.tax_return.intake_submissions.sole.payload

    expect(result).to be_success
    expect(payload).to include(
      "first_name" => "Snapshot",
      "last_name" => "Client",
      "email" => "snapshot-client@example.com",
      "tax_year" => 2026
    )
    expect(payload).to have_key("dependents")
    expect(payload).to have_key("income_sources")
    expect(payload).not_to have_key("bank_routing_number")
    expect(payload).not_to have_key("bank_account_number")
    expect(payload).not_to have_key("ssn")
    expect(payload).not_to have_key("itin")
  end

  it "returns a friendly error when a concurrent duplicate return hits the database constraint" do
    allow_any_instance_of(TaxReturn).to receive(:save!).and_raise(
      ActiveRecord::RecordNotUnique.new("duplicate key value violates unique constraint")
    )

    result = described_class.call(
      first_name: "Concurrent",
      last_name: "Client",
      email: "concurrent-client@example.com",
      tax_year: 2026
    )

    expect(result).not_to be_success
    expect(result.errors).to eq([
      "A tax return for this client and tax year is already being processed. Please contact Cornerstone if you need to update your submission."
    ])
  end
end
