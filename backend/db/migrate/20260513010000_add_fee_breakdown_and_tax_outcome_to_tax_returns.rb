# frozen_string_literal: true

class AddFeeBreakdownAndTaxOutcomeToTaxReturns < ActiveRecord::Migration[8.1]
  def change
    change_table :tax_returns, bulk: true do |t|
      t.jsonb :fee_line_items, default: [], null: false
      t.string :tax_outcome_status, default: "unknown", null: false
      t.integer :tax_outcome_amount_cents, default: 0, null: false
      t.text :tax_outcome_notes
    end

    add_index :tax_returns, :tax_outcome_status
  end
end
