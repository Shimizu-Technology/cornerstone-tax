class CreateOperationTemplates < ActiveRecord::Migration[8.1]
  def change
    create_table :operation_templates do |t|
      t.string :name, null: false
      t.text :description
      t.string :category, null: false, default: "general"
      t.string :recurrence_type, null: false, default: "monthly"
      t.integer :recurrence_interval
      t.date :recurrence_anchor
      t.boolean :auto_generate, null: false, default: true
      t.boolean :is_active, null: false, default: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :operation_templates, :name, unique: true
    add_index :operation_templates, :is_active
    add_index :operation_templates, :recurrence_type
  end
end
