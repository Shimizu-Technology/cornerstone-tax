# frozen_string_literal: true

class AddForeignKeysAndIndexesForServices < ActiveRecord::Migration[8.1]
  def change
    # Add composite unique index on client_service_types
    # (the model has uniqueness validation, this adds DB-level enforcement)
    unless index_exists?(:client_service_types, [:client_id, :service_type_id], name: 'index_client_service_types_unique')
      add_index :client_service_types, [:client_id, :service_type_id], 
                unique: true, 
                name: 'index_client_service_types_unique'
    end

    # Add foreign key constraints for data integrity (skip if already exists)
    unless foreign_key_exists?(:service_tasks, :service_types)
      add_foreign_key :service_tasks, :service_types, on_delete: :cascade
    end
    unless foreign_key_exists?(:client_service_types, :clients)
      add_foreign_key :client_service_types, :clients, on_delete: :cascade
    end
    unless foreign_key_exists?(:client_service_types, :service_types)
      add_foreign_key :client_service_types, :service_types, on_delete: :cascade
    end
    
    # Foreign keys for time_entries (nullify on delete since these are optional)
    unless foreign_key_exists?(:time_entries, :service_types)
      add_foreign_key :time_entries, :service_types, on_delete: :nullify
    end
    unless foreign_key_exists?(:time_entries, :service_tasks)
      add_foreign_key :time_entries, :service_tasks, on_delete: :nullify
    end
  end
end
