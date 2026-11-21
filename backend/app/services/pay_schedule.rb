# frozen_string_literal: true

# Pay periods from Settings > Pay schedule, for the work summary's "This pay
# period" and "Last pay period" presets.
#   semi_monthly: the 1st-15th and the 16th-end of each month (the default);
#   biweekly:     14 days at a time, counted from time_pay_period_anchor;
#   weekly:       7 days at a time, counted from time_pay_period_anchor.
# The anchor is the first day of any one period, past or future. Biweekly and
# weekly without a valid anchor fall back to semi-monthly.
module PaySchedule
  SCHEDULE_KEY = "time_pay_schedule"
  ANCHOR_KEY = "time_pay_period_anchor"
  SCHEDULES = %w[semi_monthly biweekly weekly].freeze
  DEFAULT = "semi_monthly"
  LENGTHS = { "biweekly" => 14, "weekly" => 7 }.freeze
  LABELS = {
    "semi_monthly" => "Semi-monthly (1st–15th and 16th–end of month)",
    "biweekly" => "Every two weeks",
    "weekly" => "Every week"
  }.freeze

  Period = Struct.new(:start_date, :end_date) do
    def as_json(*)
      { start_date: start_date.iso8601, end_date: end_date.iso8601 }
    end
  end

  module_function

  def schedule
    value = Setting.get(SCHEDULE_KEY).to_s
    return DEFAULT unless SCHEDULES.include?(value)
    return DEFAULT if LENGTHS.key?(value) && anchor.nil?

    value
  end

  def anchor
    value = Setting.get(ANCHOR_KEY)
    value.present? ? Date.iso8601(value.to_s) : nil
  rescue Date::Error
    nil
  end

  # The period containing date.
  def period_for(date, schedule_name = schedule, anchor_date = anchor)
    if (length = LENGTHS[schedule_name]) && anchor_date
      offset = ((date - anchor_date).to_i / length.to_f).floor * length
      start = anchor_date + offset
      Period.new(start, start + (length - 1))
    elsif date.day <= 15
      Period.new(date.beginning_of_month, date.beginning_of_month + 14)
    else
      Period.new(date.beginning_of_month + 15, date.end_of_month)
    end
  end

  def current_and_previous(today = Time.current.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).to_date)
    name = schedule
    anchor_date = anchor
    current = period_for(today, name, anchor_date)
    previous = period_for(current.start_date - 1, name, anchor_date)
    { schedule: name, label: LABELS.fetch(name), current: current, previous: previous }
  end
end
