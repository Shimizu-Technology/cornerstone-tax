class AddUniqueIndexesToServiceTables < ActiveRecord::Migration[8.1]
  def change
    # Enforce uniqueness at DB level for service_types.name
    add_index :service_types, :name, unique: true, name: "index_service_types_on_name_unique"

    # Enforce uniqueness at DB level for service_tasks.name scoped to service_type
    add_index :service_tasks, [:service_type_id, :name], unique: true, name: "index_service_tasks_on_type_and_name_unique"
  end
end
