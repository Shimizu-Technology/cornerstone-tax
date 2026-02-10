# frozen_string_literal: true

class AddDependencyTemplateTaskIdsToOperationTemplateTasks < ActiveRecord::Migration[8.1]
  def change
    add_column :operation_template_tasks, :dependency_template_task_ids, :integer, array: true, default: [], null: false
  end
end
