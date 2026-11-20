# frozen_string_literal: true

# Internal work (office, errands, meetings, training, admin) gets a real,
# protected client so every hour can be attributed to a client, plus a short
# editable list of internal categories shown for that client.
class AddInternalClientAndCategories < ActiveRecord::Migration[8.1]
  # Kept literal (not ServiceType::INTERNAL_DEFAULTS) so the migration does
  # not change if the model's list does.
  INTERNAL_CATEGORIES = [ "Office & errands", "Meetings with Dafne", "Training", "Admin" ].freeze

  def up
    add_column :clients, :system_kind, :string
    add_index :clients, :system_kind, unique: true, where: "system_kind IS NOT NULL"
    add_check_constraint :clients, "system_kind IS NULL OR system_kind IN ('internal')", name: "check_clients_system_kind"

    add_column :service_types, :internal, :boolean, null: false, default: false
    add_index :service_types, :internal

    execute <<~SQL
      INSERT INTO clients (first_name, last_name, business_name, client_type, has_tax_returns, is_new_client,
                           notification_preference, system_kind, created_at, updated_at)
      SELECT 'Internal', 'Cornerstone', 'Internal – Cornerstone', 'business', FALSE, FALSE, 'none', 'internal', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM clients WHERE system_kind = 'internal')
    SQL

    # Existing categories with the same name are left as they are.
    INTERNAL_CATEGORIES.each_with_index do |name, index|
      execute <<~SQL
        INSERT INTO service_types (name, internal, is_active, position, color, created_at, updated_at)
        SELECT #{connection.quote(name)}, TRUE, TRUE, #{1000 + index}, '#64748b', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE name = #{connection.quote(name)})
      SQL
    end
  end

  def down
    # Lines and entries pointing at the internal client become unassigned.
    execute "UPDATE time_entry_allocations SET client_id = NULL WHERE client_id IN (SELECT id FROM clients WHERE system_kind = 'internal')"
    execute "UPDATE time_entries SET client_id = NULL WHERE client_id IN (SELECT id FROM clients WHERE system_kind = 'internal')"
    execute "DELETE FROM clients WHERE system_kind = 'internal'"
    remove_column :service_types, :internal
    remove_check_constraint :clients, name: "check_clients_system_kind"
    remove_index :clients, :system_kind
    remove_column :clients, :system_kind
  end
end
