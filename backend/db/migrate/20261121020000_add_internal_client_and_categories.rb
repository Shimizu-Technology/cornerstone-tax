# frozen_string_literal: true

# Internal work (office, errands, meetings, training, admin) gets a real,
# protected client so every hour can be attributed to a client, plus a short
# editable list of internal categories shown for that client.
#
# Seeds have stable identities (clients.system_kind, service_types.system_key)
# and are matched again on re-apply, so rolling back and forward never
# duplicates them or leaves them un-flagged:
# - down drops the flag columns but keeps the rows (time stays attributed)
#   and keeps service_types.system_key, so a renamed seed is still found;
# - up finds each seed by system_key, then by name, and re-marks it instead
#   of skipping it.
#   That includes a category staff created with the same name (case
#   insensitive): it is reused as the internal category and the reuse is
#   logged. Renaming it back is up to an admin.
class AddInternalClientAndCategories < ActiveRecord::Migration[8.1]
  INTERNAL_CLIENT_NAME = "Internal – Cornerstone"
  # Kept literal (not ServiceType::INTERNAL_DEFAULTS) so this migration does
  # not change if the model's list does.
  INTERNAL_CATEGORIES = {
    "internal_office_errands" => "Office & errands",
    "internal_meetings" => "Meetings with Dafne",
    "internal_training" => "Training",
    "internal_admin" => "Admin"
  }.freeze

  def up
    add_column :clients, :system_kind, :string
    add_index :clients, :system_kind, unique: true, where: "system_kind IS NOT NULL"
    add_check_constraint :clients, "system_kind IS NULL OR system_kind IN ('internal')", name: "check_clients_system_kind"

    add_column :service_types, :internal, :boolean, null: false, default: false
    add_index :service_types, :internal
    # Survives a rollback (see down), so only added the first time.
    add_column :service_types, :system_key, :string unless column_exists?(:service_types, :system_key)
    add_index :service_types, :system_key, unique: true, where: "system_key IS NOT NULL" unless index_exists?(:service_types, :system_key)

    seed_internal_client
    seed_internal_categories
  end

  def down
    # Rows stay: entries and lines keep pointing at the internal client and
    # categories, which become ordinary records until up runs again.
    # service_types.system_key is kept on purpose: it is the seeds' identity
    # (they can be renamed), the old code ignores it, and up reuses it.
    remove_index :service_types, :internal
    remove_column :service_types, :internal
    remove_check_constraint :clients, name: "check_clients_system_kind"
    remove_index :clients, :system_kind
    remove_column :clients, :system_kind
  end

  private

  def seed_internal_client
    existing = select_one(<<~SQL)
      SELECT id FROM clients WHERE business_name = #{quote(INTERNAL_CLIENT_NAME)} ORDER BY id LIMIT 1
    SQL
    if existing
      execute "UPDATE clients SET system_kind = 'internal', archived_at = NULL WHERE id = #{existing['id'].to_i}"
      report "Reusing existing client #{INTERNAL_CLIENT_NAME.inspect} (id #{existing['id']}) as the internal client"
    else
      execute <<~SQL
        INSERT INTO clients (first_name, last_name, business_name, client_type, has_tax_returns, is_new_client,
                             notification_preference, system_kind, created_at, updated_at)
        VALUES ('Internal', 'Cornerstone', #{quote(INTERNAL_CLIENT_NAME)}, 'business', FALSE, FALSE, 'none', 'internal', NOW(), NOW())
      SQL
    end
  end

  def seed_internal_categories
    INTERNAL_CATEGORIES.each_with_index do |(key, name), index|
      by_key = select_one("SELECT id FROM service_types WHERE system_key = #{quote(key)}")
      existing = by_key || select_one(<<~SQL)
        SELECT id, name FROM service_types WHERE LOWER(name) = LOWER(#{quote(name)}) AND system_key IS NULL ORDER BY id LIMIT 1
      SQL
      if by_key
        execute "UPDATE service_types SET internal = TRUE WHERE id = #{by_key['id'].to_i}"
      elsif existing
        execute "UPDATE service_types SET internal = TRUE, system_key = #{quote(key)} WHERE id = #{existing['id'].to_i}"
        report "Reusing existing category #{existing['name'].inspect} (id #{existing['id']}) as internal category #{key}"
      else
        execute <<~SQL
          INSERT INTO service_types (name, internal, system_key, is_active, position, color, created_at, updated_at)
          VALUES (#{quote(name)}, TRUE, #{quote(key)}, TRUE, #{1000 + index}, '#64748b', NOW(), NOW())
        SQL
      end
    end
  end

  def report(message)
    say message
    Rails.logger.warn("[#{self.class.name}] #{message}")
  end

  def quote(value)
    connection.quote(value)
  end
end
