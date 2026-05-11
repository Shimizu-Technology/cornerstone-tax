# frozen_string_literal: true

class ExpandTaxReturnsForOperations < ActiveRecord::Migration[8.1]
  def change
    change_table :tax_returns, bulk: true do |t|
      t.string :return_type, default: "individual", null: false
      t.string :form_type, default: "general", null: false
      t.string :jurisdiction, default: "both", null: false
      t.string :source, default: "admin_created", null: false
      t.string :priority, default: "normal", null: false
      t.datetime :received_at
      t.date :due_on

      t.string :payment_status, default: "unpaid", null: false
      t.integer :base_fee_cents, default: 0, null: false
      t.integer :discount_amount_cents, default: 0, null: false
      t.text :discount_reason
      t.integer :amount_paid_cents, default: 0, null: false
      t.datetime :paid_at
      t.text :payment_notes

      t.string :filing_status, default: "not_filed", null: false
      t.datetime :filed_at
      t.string :drt_confirmation
      t.string :irs_confirmation

      t.boolean :portal_visible, default: false, null: false
      t.boolean :documents_enabled, default: true, null: false
      t.string :signature_status, default: "not_needed", null: false
      t.datetime :signature_requested_at
      t.datetime :signed_at
    end

    remove_index :tax_returns, name: "index_tax_returns_on_client_id_and_tax_year"
    add_index :tax_returns,
      [:client_id, :tax_year, :return_type, :form_type],
      unique: true,
      name: "index_tax_returns_unique_work_item"

    add_index :tax_returns, :payment_status
    add_index :tax_returns, :filing_status
    add_index :tax_returns, :portal_visible
    add_index :tax_returns, :return_type
    add_index :tax_returns, :priority
    add_index :tax_returns, :due_on
  end
end
