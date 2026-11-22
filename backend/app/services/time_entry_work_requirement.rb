# frozen_string_literal: true

# The work-details cutover. Off until an admin sets
# Settings > time_work_details_required_from. Staff record each work line in
# the owner's order: Client -> Category -> Task -> Period -> Comments. The
# rule, for completed entries dated on or after that date:
#   - every line needs a client and a category (use "Internal – Cornerstone"
#     as the client for office work; it takes the internal categories);
#   - the task is optional, unless Settings > time_work_task_required is on:
#     then a line needs a task when its category has active tasks (a category
#     without tasks can't take one);
#   - the period and the comments (the line's `description`) are optional.
# Before the cutover nothing is required. Keep this wording in step with the
# Settings and editor hints (frontend workLinesModel.ts).
#
# Checked on clock-out, manual create, edit and approval. Background jobs
# (stale clock auto-close) are not blocked; those entries are caught at
# approval and in the admin Unassigned time view.
module TimeEntryWorkRequirement
  SETTING_KEY = "time_work_details_required_from"
  TASK_SETTING_KEY = "time_work_task_required"
  NO_LINES_MESSAGE = "Add at least one work line with a client and a category"

  module_function

  def cutover_date
    value = Setting.get(SETTING_KEY)
    value.present? ? Date.iso8601(value.to_s) : nil
  rescue Date::Error
    nil
  end

  def task_required?
    ActiveModel::Type::Boolean.new.cast(Setting.get(TASK_SETTING_KEY)) == true
  end

  def applies_to?(entry, cutover = cutover_date)
    cutover.present? && entry.work_date.present? && entry.work_date >= cutover && entry.status == "completed"
  end

  # Problems with one line, as short phrases ("client", "category", "task").
  # With details_required: false (a line dated before the cutover) only a
  # missing client counts; the admin Unassigned list uses that.
  def missing_for_line(line, task_required: task_required?, details_required: true)
    missing = []
    missing << "client" if line.client_id.blank?
    return missing unless details_required

    if line.service_type_id.blank?
      missing << "category"
    elsif task_required && line.service_task_id.blank? && line.service_type&.service_tasks&.active&.exists?
      missing << "task"
    end
    missing
  end

  # Human-readable errors for an entry, or [] when it meets the rule.
  def errors_for(entry, cutover = cutover_date)
    return [] unless applies_to?(entry, cutover)

    lines = entry.current_work_lines
    return [ NO_LINES_MESSAGE ] if lines.empty? && entry.hours.to_d.positive?

    task_required = task_required?
    lines.each_with_index.filter_map do |line, index|
      missing = missing_for_line(line, task_required: task_required)
      next if missing.empty?

      label = lines.size > 1 ? "Line #{index + 1}" : "This entry"
      "#{label} needs #{missing.to_sentence}"
    end
  end
end
