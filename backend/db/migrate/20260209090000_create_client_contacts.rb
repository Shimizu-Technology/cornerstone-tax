# frozen_string_literal: true

class CreateClientContacts < ActiveRecord::Migration[8.1]
  def change
    create_table :client_contacts do |t|
      t.references :client, null: false, foreign_key: true
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :email
      t.string :phone
      t.string :role
      t.boolean :is_primary, null: false, default: false

      t.timestamps
    end

    add_index :client_contacts,
              [:client_id, :is_primary],
              unique: true,
              where: "is_primary",
              name: "index_client_contacts_primary_unique"
  end
end
