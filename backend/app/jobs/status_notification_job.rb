# frozen_string_literal: true

class StatusNotificationJob < ApplicationJob
  queue_as :default

  def perform(tax_return_id, workflow_stage_id)
    tax_return = TaxReturn.find_by(id: tax_return_id)
    return unless tax_return

    stage = WorkflowStage.find_by(id: workflow_stage_id)
    return unless stage

    NotificationService.notify_status_change(
      tax_return: tax_return,
      new_stage: stage
    )
  end
end
