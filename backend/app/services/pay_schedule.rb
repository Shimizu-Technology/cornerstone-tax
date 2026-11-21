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

  # [schedule, anchor] from one read of both settings, so the name, label
  # and periods always describe the same configuration.
  def config
    stored = Setting.where(key: [ SCHEDULE_KEY, ANCHOR_KEY ]).pluck(:key, :value).to_h
    resolve(stored.fetch(SCHEDULE_KEY, Setting::DEFAULTS[SCHEDULE_KEY]), stored.fetch(ANCHOR_KEY, Setting::DEFAULTS[ANCHOR_KEY]))
  end

  def resolve(raw_schedule, raw_anchor)
    anchor_date = parse_anchor(raw_anchor)
    name = raw_schedule.to_s
    name = DEFAULT unless SCHEDULES.include?(name)
    name = DEFAULT if LENGTHS.key?(name) && anchor_date.nil?
    [ name, anchor_date ]
  end

  def parse_anchor(value)
    value.present? ? Date.iso8601(value.to_s) : nil
  rescue Date::Error
    nil
  end

  def schedule
    config.first
  end

  def anchor
    config.last
  end

  # The period containing date.
  def period_for(date, schedule_name = nil, anchor_date = nil)
    schedule_name, anchor_date = config if schedule_name.nil?
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
    name, anchor_date = config
    current = period_for(today, name, anchor_date)
    previous = period_for(current.start_date - 1, name, anchor_date)
    { schedule: name, label: LABELS.fetch(name), current: current, previous: previous }
  end
end
