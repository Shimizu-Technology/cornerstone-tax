# frozen_string_literal: true

# CST-28: Add check constraint to ensure role is one of the valid values
class AddRoleConstraintToUsers < ActiveRecord::Migration[8.0]
  def up
    # Add check constraint for role column
    execute <<-SQL
      ALTER TABLE users
      ADD CONSTRAINT check_valid_role
      CHECK (role IN ('admin', 'employee', 'client'))
    SQL
  end

  def down
    execute <<-SQL
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS check_valid_role
    SQL
  end
end
