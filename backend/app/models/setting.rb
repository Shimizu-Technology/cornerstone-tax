# frozen_string_literal: true

class Setting < ApplicationRecord
  validates :key, presence: true, uniqueness: true

  # Default values for settings
  DEFAULTS = {
    "contact_email" => "dmshimizucpa@gmail.com",
    "notification_email" => "dmshimizucpa@gmail.com",
    "report_business_name" => "Cornerstone Accounting & Business Services",
    "report_address" => "130 Aspinall Ave, Suite 202, Hagatna, Guam",
    "report_phone" => "(671) 828-8591",
    "report_email" => "dmshimizucpa@gmail.com",
    "overtime_daily_threshold_hours" => "8",
    "overtime_weekly_threshold_hours" => "40",
    "early_clock_in_buffer_minutes" => "5",
    # ISO date. From this work date on, every work line needs a client and a
    # description (and a category for internal work). Blank means off.
    "time_work_details_required_from" => "",
    # "true" or "false". With the cutover on, every line also needs a category
    # and, when that category has tasks, a task. See TimeEntryWorkRequirement.
    "time_work_task_required" => "false",
    # Pay periods for presets in the work summary: semi_monthly (1st-15th and
    # 16th-end of month), biweekly or weekly. Biweekly and weekly count from
    # time_pay_period_anchor, the first day of any one period. See PaySchedule.
    "time_pay_schedule" => "semi_monthly",
    "time_pay_period_anchor" => ""
  }.freeze

  # Get a setting value (with default fallback)
  def self.get(key)
    setting = find_by(key: key)
    setting&.value || DEFAULTS[key.to_s]
  end

  # Set a setting value
  def self.set(key, value, description: nil)
    setting = find_or_initialize_by(key: key)
    setting.value = value
    setting.description = description if description.present?
    setting.save!
    setting
  end

  # Get all settings as a hash
  def self.all_as_hash
    settings = all.index_by(&:key)
    DEFAULTS.merge(settings.transform_values(&:value))
  end

  def self.report_branding
    {
      "business_name" => get("report_business_name"),
      "address" => get("report_address"),
      "phone" => get("report_phone"),
      "email" => get("report_email").presence || get("contact_email")
    }
  end
end
