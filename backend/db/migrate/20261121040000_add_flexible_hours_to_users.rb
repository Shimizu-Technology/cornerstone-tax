# frozen_string_literal: true

# Per-person "Flexible hours": when on, clocking in without a schedule doesn't
# send the entry to approval. Off for everyone; admins switch it on per person.
class AddFlexibleHoursToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :flexible_hours, :boolean, null: false, default: false
  end
end
