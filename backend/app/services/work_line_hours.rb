# frozen_string_literal: true

# Turns submitted work-line durations into stored decimal hours that add up
# exactly to an entry's hours.
#
# Staff enter time in minutes ("45", "45m") or hours ("1.5h"). Minutes do not
# round cleanly to two-decimal hours (3 x 20 min = 0.33 + 0.33 + 0.33 = 0.99),
# and a clock entry's hours come from real timestamps. So each line's
# duration is used as a weight, and the entry total is split by cumulative
# rounding: line i gets round(total * cum_i / sum) - round(total * cum_i-1 /
# sum). The parts always sum to the total.
module WorkLineHours
  class Error < StandardError; end

  # How far the lines' own total may differ from the entry's hours and still
  # be spread across them. One minute covers clock seconds and minute
  # rounding; clock-out allows a few minutes because the clock keeps running
  # while the form is open.
  DEFAULT_TOLERANCE_MINUTES = 1
  CLOCK_OUT_TOLERANCE_MINUTES = 6

  DURATION_PATTERN = /\A\s*(?:(?<h>\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(?<m>\d+(?:\.\d+)?)\s*m(?:in(?:utes?|s)?)?)?\s*\z/i
  BARE_NUMBER = /\A\s*(?<n>\d+(?:\.\d+)?)\s*\z/
  CLOCK_STYLE = /\A\s*(?<h>\d+):(?<m>[0-5]\d)\s*\z/

  module_function

  # Parses "45", "45m", "1.5h", "1h 30m", "1:30" into minutes (a Rational).
  # A bare number uses default_unit (:minutes unless told otherwise).
  def parse_minutes(value, default_unit: :minutes)
    return nil if value.nil?
    if value.is_a?(Numeric)
      # Floats go through their decimal text so 1.1 means 1.1, not the
      # nearest binary fraction (which is a hair over 66 minutes).
      number = value.is_a?(Float) ? value.to_s.to_r : value.to_r
      return number * (default_unit == :hours ? 60 : 1)
    end

    text = value.to_s.strip
    return nil if text.empty?

    if (match = BARE_NUMBER.match(text))
      number = match[:n].to_r
      return default_unit == :hours ? number * 60 : number
    end

    if (match = CLOCK_STYLE.match(text))
      return match[:h].to_r * 60 + match[:m].to_r
    end

    match = DURATION_PATTERN.match(text)
    raise Error, "\"#{text}\" is not a duration. Use minutes (45 or 45m) or hours (1.5h)." if match.nil? || (match[:h].nil? && match[:m].nil?)

    match[:h].to_r * 60 + match[:m].to_r
  end

  # Minutes for one submitted line: explicit minutes, then hours, then a
  # free-form duration string.
  def line_minutes(attrs)
    attrs = attrs.to_h.symbolize_keys
    minutes = if attrs[:minutes].present?
      parse_minutes(attrs[:minutes], default_unit: :minutes)
    elsif attrs[:hours].present?
      parse_minutes(attrs[:hours], default_unit: :hours)
    elsif attrs[:duration].present?
      parse_minutes(attrs[:duration], default_unit: :minutes)
    end
    raise Error, "Each work line needs a time (minutes or hours)" if minutes.nil?
    raise Error, "Each work line needs more than 0 minutes" unless minutes.positive?

    minutes
  end

  # Total hours for lines with no clock times (a manual day log).
  def hours_for_minutes(total_minutes)
    (BigDecimal(total_minutes.to_r.numerator) / total_minutes.to_r.denominator / 60).round(2)
  end

  # Splits total_hours across the given minute weights. Raises when the
  # weights are further from total_hours than the tolerance allows.
  def distribute(total_hours, minutes_list, tolerance_minutes: DEFAULT_TOLERANCE_MINUTES)
    if total_hours.blank?
      raise Error, "Set this entry's start and end times (or leave both blank for a day log) before adding work lines"
    end

    total = BigDecimal(total_hours.to_s).round(2)
    weights = minutes_list.map(&:to_r)
    weight_sum = weights.sum
    raise Error, "Add at least one work line" if weights.empty?

    entry_minutes = total * 60
    difference = (BigDecimal(weight_sum.numerator) / weight_sum.denominator) - entry_minutes
    if difference.abs > tolerance_minutes
      raise Error, mismatch_message(total, weight_sum, difference)
    end

    cumulative = 0r
    previous = BigDecimal("0")
    weights.map do |weight|
      cumulative += weight
      rounded = (total * (BigDecimal(cumulative.numerator) / cumulative.denominator) / (BigDecimal(weight_sum.numerator) / weight_sum.denominator)).round(2)
      part = rounded - previous
      previous = rounded
      part
    end
  end

  def mismatch_message(total, weight_sum, difference)
    lines_minutes = (BigDecimal(weight_sum.numerator) / weight_sum.denominator).round
    entry_minutes = (total * 60).round
    direction = difference.positive? ? "over" : "short of"
    "Work lines add up to #{format_minutes(lines_minutes)}, #{direction} this entry's #{format_minutes(entry_minutes)} " \
      "by #{format_minutes(difference.abs.round)}. Adjust the lines so nothing is left over."
  end

  def format_minutes(minutes)
    minutes = minutes.to_i
    hours, mins = minutes.divmod(60)
    return "#{mins}m" if hours.zero?
    return "#{hours}h" if mins.zero?

    "#{hours}h #{mins}m"
  end
end
