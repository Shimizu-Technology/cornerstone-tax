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

  # One submitted line's time, as either
  #   { exact: BigDecimal } - exact_hours: an unchanged line's stored hours,
  #                           kept exactly as sent, never rescaled; or
  #   { minutes: Rational } - minutes / hours / duration: a line the person
  #                           changed (or a new one); these absorb rounding
  #                           and whatever time the exact lines leave.
  # Contract: docs/TIME_ENTRY_WORK_LINES_API.md.
  def line_time(attrs)
    attrs = attrs.to_h.symbolize_keys
    return { minutes: line_minutes(attrs) } if attrs[:exact_hours].blank?

    exact = begin
      BigDecimal(attrs[:exact_hours].to_s)
    rescue ArgumentError
      raise Error, "exact_hours must be a number of hours (e.g. 0.25)"
    end
    raise Error, "exact_hours must be more than 0" unless exact.positive?
    raise Error, "exact_hours can have at most two decimals (it is a line's stored hours)" unless exact == exact.round(2)

    { exact: exact }
  end

  # Line hours for a mix of exact and changed lines. Exact lines keep their
  # hours. The changed lines share what is left (total minus exact) by
  # their minutes, with cumulative rounding; they must come within the
  # tolerance of that remainder (plus one minute per exact line, the most
  # their rounded display minutes can be off), and each must still get
  # more than zero. Otherwise this raises instead of touching exact lines.
  def allocate(total_hours, times, tolerance_minutes: DEFAULT_TOLERANCE_MINUTES)
    raise Error, "Add at least one work line" if times.empty?
    if total_hours.blank?
      raise Error, "Set this entry's start and end times (or leave both blank for a day log) before adding work lines"
    end

    total = BigDecimal(total_hours.to_s).round(2)
    exact_sum = times.sum { |time| time[:exact] || 0 }
    flexible = times.each_index.reject { |index| times[index][:exact] }

    if flexible.empty?
      return times.map { |time| time[:exact] } if exact_sum == total

      raise Error, "The unchanged lines add up to #{format('%.2f', exact_sum)}h but this entry is #{format('%.2f', total)}h. " \
                   "Change at least one line's time so they add up."
    end

    remainder = total - exact_sum
    unless remainder.positive?
      raise Error, "The lines you didn't change already use #{format('%.2f', exact_sum)}h of this entry's #{format('%.2f', total)}h, " \
                   "so the changed lines have no time left. Change the other lines too."
    end

    exact_count = times.size - flexible.size
    flexible_minutes = flexible.map { |index| times[index][:minutes] }
    parts = begin
      distribute(remainder, flexible_minutes, tolerance_minutes: tolerance_minutes + exact_count)
    rescue Error
      raise if exact_count.zero?

      raise Error, "The changed lines add up to #{format_minutes(flexible_minutes.sum.round)}, but " \
                   "#{format_minutes((remainder * 60).round)} is left after the lines you didn't change. Adjust the changed lines."
    end
    if parts.any? { |part| part <= 0 }
      raise Error, "A changed line would get no time once the unchanged lines keep theirs. Change the other lines too."
    end

    flexible_parts = flexible.zip(parts).to_h
    times.each_index.map { |index| times[index][:exact] || flexible_parts.fetch(index) }
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
