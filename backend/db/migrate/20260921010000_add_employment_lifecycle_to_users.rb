# frozen_string_literal: true

class AddEmploymentLifecycleToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :employment_status, :string, null: false, default: "active"
    add_column :users, :termination_effective_on, :date
    add_column :users, :terminated_at, :datetime
    add_column :users, :termination_reason, :text
    add_reference :users, :terminated_by, foreign_key: { to_table: :users }, null: true

    add_index :users, :employment_status
    add_check_constraint :users,
                         "employment_status IN ('active', 'terminated')",
                         name: "check_valid_employment_status"
  end
end
