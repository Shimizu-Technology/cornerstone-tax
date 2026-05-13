# frozen_string_literal: true

class CreateIntakeSubmissions < ActiveRecord::Migration[8.1]
  def change
    create_table :intake_submissions do |t|
      t.references :client, null: false, foreign_key: true
      t.references :tax_return, null: false, foreign_key: true
      t.jsonb :payload, default: {}, null: false
      t.string :source, default: "public_intake", null: false
      t.string :status, default: "received", null: false
      t.datetime :submitted_at, null: false

      t.timestamps
    end

    add_index :intake_submissions, :source
    add_index :intake_submissions, :status
    add_index :intake_submissions, :submitted_at
  end
end
