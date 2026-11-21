# frozen_string_literal: true

require "rails_helper"

RSpec.describe ServiceType, type: :model do
  describe "#destroy" do
    let(:service_type) { described_class.create!(name: "Bookkeeping") }
    let!(:task) { ServiceTask.create!(service_type: service_type, name: "Bank Reconciliation") }

    it "explains a refusal when the category's task has logged time" do
      create(:time_entry, service_type: service_type, service_task: task)

      expect(service_type.destroy).to be(false)
      expect(service_type.errors.full_messages).to eq([ "Cannot delete record because dependent time entries exist" ])
      expect(described_class.exists?(service_type.id)).to be(true)
      expect(ServiceTask.exists?(task.id)).to be(true)
    end

    it "surfaces the task's refusal when only the task carries the time" do
      entry = create(:time_entry, service_type: service_type, service_task: task)
      # Legacy rows: the task is set but the category isn't.
      entry.update_columns(service_type_id: nil)
      entry.work_lines.each { |line| line.update_columns(service_type_id: nil) }

      expect(service_type.destroy).to be(false)
      expect(service_type.errors.full_messages).to eq([ "Task Bank Reconciliation: Cannot delete record because dependent time entries exist" ])
      expect(ServiceTask.exists?(task.id)).to be(true)
    end

    it "keeps every task when a later task refuses" do
      free_task = ServiceTask.create!(service_type: service_type, name: "Payroll", position: 0)
      entry = create(:time_entry, service_type: service_type, service_task: task)
      entry.update_columns(service_type_id: nil)
      entry.work_lines.each { |line| line.update_columns(service_type_id: nil) }

      expect(service_type.destroy).to be(false)
      expect(ServiceTask.exists?(free_task.id)).to be(true)
    end

    it "deletes a category and its tasks when no time uses them" do
      expect(service_type.destroy).to be_truthy
      expect(ServiceTask.exists?(task.id)).to be(false)
    end
  end
end
