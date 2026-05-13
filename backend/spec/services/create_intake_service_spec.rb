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

  it "links public intake to an existing staff-created 1040 return for the same client and year" do
    client = Client.create!(
      first_name: "Existing",
      last_name: "Client",
      email: "existing-client@example.com"
    )
    staff_return = client.tax_returns.create!(
      tax_year: 2026,
      return_type: "individual",
      form_type: "1040",
      source: "admin_created",
      portal_visible: false,
      documents_enabled: false
    )

    expect do
      result = described_class.call(
        first_name: "Existing",
        last_name: "Client",
        email: "existing-client@example.com",
        tax_year: 2026,
        income_sources: [
          {
            source_type: "w2",
            payer_name: "Employer"
          }
        ]
      )

      expect(result).to be_success
      expect(result.tax_return).to eq(staff_return)
      expect(result.tax_return.form_type).to eq("1040")
      expect(result.tax_return.source).to eq("admin_created")
      expect(result.tax_return.portal_visible).to be(false)
      expect(result.tax_return.documents_enabled).to be(false)
      expect(result.tax_return.intake_submissions.count).to eq(1)
    end.not_to change(TaxReturn, :count)
  end

  it "creates new intake returns as 1040 work items" do
    result = described_class.call(
      first_name: "New",
      last_name: "Client",
      email: "new-intake-return@example.com",
      tax_year: 2026
    )

    expect(result).to be_success
    expect(result.tax_return.return_type).to eq("individual")
    expect(result.tax_return.form_type).to eq("1040")
  end
end
