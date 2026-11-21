# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("db/migrate/20261121020000_add_internal_client_and_categories").to_s

# Runs the real migration inside the example's transaction (PostgreSQL DDL
# is transactional). The test schema already has the columns, so each
# example starts with down and ends with up.
RSpec.describe AddInternalClientAndCategories do
  let(:migration) { described_class.new }
  let(:connection) { ActiveRecord::Base.connection }
  let(:keys) { %w[internal_office_errands internal_meetings internal_training internal_admin] }

  def quietly(&block)
    ActiveRecord::Migration.suppress_messages(&block)
  end

  def reset_models
    [ Client, ServiceType, TimeEntryAllocation ].each(&:reset_column_information)
  end

  def internal_categories
    connection.select_rows("SELECT system_key, name, internal FROM service_types WHERE system_key IS NOT NULL ORDER BY system_key")
  end

  after { reset_models }

  it "seeds the internal client and four keyed internal categories" do
    quietly { migration.down }
    quietly { migration.up }
    reset_models

    expect(Client.internal.display_name).to eq("Internal – Cornerstone")
    expect(internal_categories).to contain_exactly(
      [ "internal_admin", "Admin", true ], [ "internal_meetings", "Meetings with Dafne", true ],
      [ "internal_office_errands", "Office & errands", true ], [ "internal_training", "Training", true ]
    )
  end

  it "rolls back and re-applies without duplicating or un-flagging the seeds, keeping time attributed" do
    quietly { migration.down }
    quietly { migration.up }
    reset_models
    internal = Client.internal
    office = ServiceType.find_by!(system_key: "internal_office_errands")
    office.update!(name: "Errands & office")
    entry = create(:time_entry, user: create(:user, :employee), approval_status: "approved")
    entry.work_lines_input = [ { client_id: internal.id, service_type_id: office.id, description: "Bank run", minutes: 480 } ]
    entry.save!

    quietly { migration.down }
    expect(connection.column_exists?(:service_types, :internal)).to be(false)
    expect(connection.column_exists?(:clients, :system_kind)).to be(false)
    # The seeds' identity outlives the rollback.
    expect(connection.column_exists?(:service_types, :system_key)).to be(true)
    expect(connection.select_rows("SELECT client_id, service_type_id FROM time_entry_allocations WHERE time_entry_id = #{entry.id}"))
      .to eq([ [ internal.id, office.id ] ])

    quietly { migration.up }
    reset_models
    expect(Client.internal.id).to eq(internal.id)
    expect(ServiceType.internal_work.pluck(:system_key)).to match_array(keys)
    expect(ServiceType.find(office.id)).to have_attributes(internal: true, name: "Errands & office", system_key: "internal_office_errands")
    expect(ServiceType.where(name: "Office & errands")).to be_empty
    expect(Client.where(business_name: "Internal – Cornerstone").count).to eq(1)
  end

  it "reuses a staff-made category with a seed's name on first deploy, marks it internal and logs it" do
    quietly { migration.down }
    connection.execute("DELETE FROM service_types")
    staff_admin_id = connection.select_value(<<~SQL)
      INSERT INTO service_types (name, is_active, position, created_at, updated_at) VALUES ('admin', TRUE, 3, NOW(), NOW()) RETURNING id
    SQL

    allow(Rails.logger).to receive(:warn).and_call_original
    quietly { migration.up }
    reset_models

    expect(Rails.logger).to have_received(:warn).with(/Reusing existing category "admin" \(id #{staff_admin_id}\) as internal category internal_admin/)
    reused = ServiceType.find(staff_admin_id)
    expect(reused).to have_attributes(internal: true, system_key: "internal_admin", name: "admin")
    expect(ServiceType.where("LOWER(name) = 'admin'").count).to eq(1)
    expect(ServiceType.internal_work.pluck(:system_key)).to match_array(keys)
  end

  it "keeps ensure_internal_defaults! consistent with the migration" do
    quietly { migration.down }
    quietly { migration.up }
    reset_models
    ServiceType.find_by!(system_key: "internal_training").update!(name: "Courses")
    ServiceType.find_by!(system_key: "internal_admin").update_columns(internal: false)

    expect { ServiceType.ensure_internal_defaults! }.not_to change(ServiceType, :count)
    expect(ServiceType.find_by!(system_key: "internal_admin")).to be_internal
    expect(ServiceType.find_by!(system_key: "internal_training").name).to eq("Courses")
  end
end
