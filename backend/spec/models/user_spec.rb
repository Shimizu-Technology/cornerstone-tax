# frozen_string_literal: true

require "rails_helper"

RSpec.describe User, type: :model do
  describe "employment lifecycle" do
    let(:admin) { create(:user, :admin) }
    let(:employee) { create(:user, :employee) }

    it "terminates and reactivates without changing identity" do
      original_clerk_id = employee.clerk_id

      employee.terminate!(by: admin, effective_on: Date.current, reason: "Season ended")

      expect(employee).to be_terminated
      expect(employee.termination_effective_on).to eq(Date.current)
      expect(employee.terminated_by).to eq(admin)
      expect(employee.clerk_id).to eq(original_clerk_id)

      employee.reactivate!

      expect(employee).to be_employment_active
      expect(employee.terminated_at).to be_nil
      expect(employee.termination_effective_on).to be_nil
      expect(employee.terminated_by).to be_nil
    end

    it "excludes terminated people only from the active staff scope" do
      employee.terminate!(by: admin)

      expect(User.staff).to include(employee)
      expect(User.active_staff).not_to include(employee)
    end

    it "blocks hard deletion" do
      expect(employee.destroy).to eq(false)
      expect(employee.errors.full_messages).to include("Users cannot be permanently deleted; terminate or deactivate the account instead")
      expect(User.exists?(employee.id)).to eq(true)
    end
  end
end
