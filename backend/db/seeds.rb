# frozen_string_literal: true

# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

puts "Seeding database..."

# ============================================
# Workflow Stages (Configurable)
# ============================================
puts "Creating workflow stages..."

workflow_stages = [
  { name: "Intake Received", slug: "intake_received", position: 1, color: "#6B7280", notify_client: false, description: "Client submitted intake form" },
  { name: "Documents Pending", slug: "documents_pending", position: 2, color: "#F59E0B", notify_client: true, description: "Waiting for client documents (W-2s, 1099s, etc.)" },
  { name: "In Preparation", slug: "in_preparation", position: 3, color: "#3B82F6", notify_client: false, description: "Tax preparer is working on the return" },
  { name: "In Review", slug: "in_review", position: 4, color: "#8B5CF6", notify_client: false, description: "Return is being reviewed by supervisor" },
  { name: "Ready to Sign", slug: "ready_to_sign", position: 5, color: "#10B981", notify_client: true, description: "Return is ready for client signature" },
  { name: "Filing", slug: "filing", position: 6, color: "#06B6D4", notify_client: false, description: "Return is being submitted to IRS/Guam DRT" },
  { name: "Ready for Pickup", slug: "ready_for_pickup", position: 7, color: "#22C55E", notify_client: true, description: "Return is complete and ready for client pickup" },
  { name: "Complete", slug: "complete", position: 8, color: "#64748B", notify_client: false, description: "Return has been picked up, case closed" }
]

workflow_stages.each do |attrs|
  stage = WorkflowStage.find_or_initialize_by(slug: attrs[:slug])
  stage.assign_attributes(attrs)
  stage.save!
  puts "  ✓ #{stage.name}"
end

# ============================================
# Time Categories (Configurable)
# ============================================
puts "Creating time categories..."

time_categories = [
  { name: "Tax Preparation", description: "Preparing individual or business tax returns" },
  { name: "Client Consultation", description: "Meetings, calls, and emails with clients" },
  { name: "Document Review", description: "Reviewing client-submitted documents" },
  { name: "Administrative", description: "General office and administrative tasks" },
  { name: "Training", description: "Professional development and training" }
]

time_categories.each do |attrs|
  category = TimeCategory.find_or_initialize_by(name: attrs[:name])
  category.assign_attributes(attrs)
  category.save!
  puts "  ✓ #{category.name}"
end

# ============================================
# Schedule Time Presets (Configurable)
# ============================================
puts "Creating schedule time presets..."

schedule_presets = [
  { label: "8-1", start_time: "08:00", end_time: "13:00", position: 0 },
  { label: "8-5", start_time: "08:00", end_time: "17:00", position: 1 },
  { label: "8:30-5", start_time: "08:30", end_time: "17:00", position: 2 },
  { label: "9-5", start_time: "09:00", end_time: "17:00", position: 3 },
  { label: "12:30-5", start_time: "12:30", end_time: "17:00", position: 4 },
  { label: "1-5", start_time: "13:00", end_time: "17:00", position: 5 }
]

schedule_presets.each do |attrs|
  preset = ScheduleTimePreset.find_or_initialize_by(label: attrs[:label])
  preset.assign_attributes(attrs)
  preset.save!
  puts "  ✓ #{preset.label}"
end

puts ""
puts "✅ Seeding complete!"
puts "   - #{WorkflowStage.count} workflow stages"
puts "   - #{TimeCategory.count} time categories"
puts "   - #{ScheduleTimePreset.count} schedule time presets"
