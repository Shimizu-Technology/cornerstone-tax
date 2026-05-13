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

    expect(tax_return.workflow_events.where(event_type: %w[
      status_changed assigned note_added payment_updated filing_updated tax_outcome_updated portal_updated
    ])).to be_empty
  end

  it "does not log assignment or notes audit events when those fields are set on creation" do
    assignee = User.create!(
      clerk_id: "tax-return-assignee",
      email: "assignee@example.com",
      role: "employee"
    )

    tax_return = described_class.create!(
      client: client,
      tax_year: 2026,
      assigned_to: assignee,
      notes: ""
    )

    expect(tax_return.workflow_events.where(event_type: %w[assigned note_added])).to be_empty
  end

  it "logs operational changes after creation" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(
      payment_status: "paid",
      filing_status: "filed_irs",
      tax_outcome_status: "refund",
      portal_visible: true,
      signature_status: "signed"
    )

    expect(tax_return.workflow_events.pluck(:event_type)).to include(
      "payment_updated",
      "filing_updated",
      "tax_outcome_updated",
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

  it "includes fee line items in the final fee and balance due" do
    tax_return = described_class.create!(
      client: client,
      tax_year: 2026,
      base_fee_cents: 8_500,
      fee_line_items: [
        { label: "Schedule C", amount_cents: 4_000, notes: "" },
        { label: "Rental schedule", amount_cents: 3_000, notes: "" }
      ],
      discount_amount_cents: 2_000,
      amount_paid_cents: 5_000
    )

    expect(tax_return.fee_line_items_total_cents).to eq(7_000)
    expect(tax_return.final_fee_cents).to eq(13_500)
    expect(tax_return.balance_due_cents).to eq(8_500)
  end

  it "records changed filing fields in filing audit values" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(drt_confirmation: "DRT-123")

    event = tax_return.workflow_events.find_by!(event_type: "filing_updated")
    expect(event.old_value).to eq("drt_confirmation: none")
    expect(event.new_value).to eq("drt_confirmation: DRT-123")
  end

  it "records changed tax outcome fields separately from filing audit values" do
    tax_return = described_class.create!(client: client, tax_year: 2026)

    tax_return.update!(tax_outcome_status: "tax_due", tax_outcome_amount_cents: 42_000)

    event = tax_return.workflow_events.find_by!(event_type: "tax_outcome_updated")
    expect(event.old_value).to eq("tax_outcome_status: unknown; tax_outcome_amount_cents: 0")
    expect(event.new_value).to eq("tax_outcome_status: tax_due; tax_outcome_amount_cents: 42000")
    expect(tax_return.workflow_events.where(event_type: "filing_updated")).to be_empty
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

    tax_return.update!(filing_status: "paper_filed", signature_status: "signed")

    expect(tax_return.filed_at).to be_present
  end

  it "requests a signature automatically when moved to ready to sign" do
    intake_stage = WorkflowStage.create!(name: "Intake Received", slug: "intake_received", position: 1)
    ready_to_sign_stage = WorkflowStage.create!(name: "Ready to Sign", slug: "ready_to_sign", position: 2)
    tax_return = described_class.create!(client: client, tax_year: 2026, workflow_stage: intake_stage)

    tax_return.update!(workflow_stage: ready_to_sign_stage)

    expect(tax_return.signature_status).to eq("requested")
    expect(tax_return.signature_requested_at).to be_present
    expect(tax_return.workflow_events.pluck(:event_type)).to contain_exactly("status_changed")
  end

  it "does not allow filing before the signature is signed or waived" do
    filing_stage = WorkflowStage.create!(name: "Filing", slug: "filing", position: 1)
    tax_return = described_class.create!(client: client, tax_year: 2026)

    expect(tax_return.update(workflow_stage: filing_stage)).to be(false)
    expect(tax_return.errors[:signature_status]).to include("must be signed or waived before filing")

    expect(tax_return.update(signature_status: "signed", workflow_stage: filing_stage)).to be(true)
  end
end
