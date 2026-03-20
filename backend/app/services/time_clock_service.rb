# frozen_string_literal: true

class TimeClockService
  class ClockError < StandardError; end
  class AuthorizationError < StandardError; end

  class << self
    # ── Clock In ──
    def clock_in(user:, admin_override_by: nil)
      now = Time.current
      today = Time.current.in_time_zone(business_timezone).to_date

      raise ClockError, "You are already clocked in" if active_entry_for(user)

      schedule = Schedule.for_user(user.id).for_date(today).first

      unless schedule || admin_override_by
        raise ClockError, "No shift scheduled for today. Contact your manager if you need to work today."
      end

      if schedule && !admin_override_by
        validate_clock_in_time(now, schedule)
      end

      entry = TimeEntry.new(
        user: user,
        work_date: today,
        start_time: now,
        clock_in_at: now,
        entry_method: "clock",
        status: "clocked_in",
        hours: 0,
        schedule: schedule,
        admin_override: admin_override_by.present?,
        approval_status: nil,
        attendance_status: schedule ? calculate_attendance_status(now, schedule) : nil
      )

      entry.save!
      entry
    end

    # ── Clock Out ──
    def clock_out(user:)
      entry = active_entry_for(user)
      raise ClockError, "You are not currently clocked in" unless entry

      if entry.status == "on_break"
        active_break = entry.active_break
        active_break&.close!
      end

      now = Time.current
      entry.end_time = now
      entry.clock_out_at = now
      entry.status = "completed"
      entry.break_minutes = entry.total_break_minutes
      entry.calculate_hours_from_times
      entry.overtime_status = check_overtime_status(user, entry)

      entry.save!
      entry
    end

    # ── Start Break ──
    def start_break(user:)
      entry = active_entry_for(user)
      raise ClockError, "You are not currently clocked in" unless entry
      raise ClockError, "You are already on a break" if entry.status == "on_break"

      now = Time.current
      entry.time_entry_breaks.create!(start_time: now)
      entry.update!(status: "on_break")
      entry
    end

    # ── End Break ──
    def end_break(user:)
      entry = active_entry_for(user)
      raise ClockError, "You are not currently clocked in" unless entry
      raise ClockError, "You are not currently on a break" unless entry.status == "on_break"

      active_break = entry.active_break
      raise ClockError, "No active break found" unless active_break

      active_break.close!
      entry.update!(status: "clocked_in")
      entry
    end

    # ── Current Status ──
    def current_status(user:)
      entry = active_entry_for(user)
      today = Time.current.in_time_zone(business_timezone).to_date
      schedule = Schedule.for_user(user.id).for_date(today).first

      clock_in_info = can_clock_in_info(user, schedule)

      {
        clocked_in: entry.present?,
        status: entry&.status,
        entry_id: entry&.id,
        clock_in_at: entry&.clock_in_at,
        elapsed_minutes: entry ? ((Time.current - entry.clock_in_at) / 60).round : nil,
        break_minutes: entry&.total_break_minutes || 0,
        active_break: entry&.active_break.present?,
        active_break_started_at: entry&.active_break&.start_time,
        breaks: entry ? entry.time_entry_breaks.order(:start_time).map { |b|
          { start_time: b.start_time, end_time: b.end_time, duration_minutes: b.duration_minutes, active: b.active? }
        } : [],
        schedule: schedule ? {
          id: schedule.id,
          start_time: schedule.formatted_start_time,
          end_time: schedule.formatted_end_time,
          hours: schedule.hours
        } : nil,
        can_clock_in: clock_in_info[:allowed],
        clock_in_blocked_reason: clock_in_info[:reason],
        minutes_until: clock_in_info[:minutes_until]
      }
    end

    # ── Admin: Approve Entry ──
    def approve_entry(entry:, approved_by:, note: nil)
      raise AuthorizationError, "Only admins can approve entries" unless approved_by.admin?
      raise ClockError, "Entry is not pending approval" unless entry.pending_approval?

      entry.update!(
        approval_status: "approved",
        approved_by: approved_by,
        approved_at: Time.current,
        approval_note: note
      )
      entry
    end

    # ── Admin: Deny Entry ──
    def deny_entry(entry:, denied_by:, note: nil)
      raise AuthorizationError, "Only admins can deny entries" unless denied_by.admin?
      raise ClockError, "Entry is not pending approval" unless entry.pending_approval?

      entry.update!(
        approval_status: "denied",
        approved_by: denied_by,
        approved_at: Time.current,
        approval_note: note
      )
      entry
    end

    # ── Admin: Approve Overtime ──
    def approve_overtime(entry:, approved_by:, note: nil)
      raise AuthorizationError, "Only admins can approve overtime" unless approved_by.admin?
      raise ClockError, "Entry does not have pending overtime" unless entry.overtime_status == "pending"

      entry.update!(
        overtime_status: "approved",
        overtime_approved_by: approved_by,
        overtime_approved_at: Time.current,
        overtime_note: note
      )
      entry
    end

    # ── Admin: Deny Overtime ──
    def deny_overtime(entry:, denied_by:, note: nil)
      raise AuthorizationError, "Only admins can deny overtime" unless denied_by.admin?
      raise ClockError, "Entry does not have pending overtime" unless entry.overtime_status == "pending"

      entry.update!(
        overtime_status: "denied",
        overtime_approved_by: denied_by,
        overtime_approved_at: Time.current,
        overtime_note: note
      )
      entry
    end

    # ── Helpers ──

    def active_entry_for(user)
      TimeEntry.clocked_in.for_user(user).order(created_at: :desc).first
    end

    def hours_today(user, date = Date.current)
      TimeEntry.countable.for_user(user).for_date(date).sum(:hours).to_f
    end

    def hours_this_week(user, date = Date.current)
      TimeEntry.countable.for_user(user).for_week(date).sum(:hours).to_f
    end

    private

    # Schedule times are stored as wall-clock times in UTC (e.g., 7:30 PM stored
    # as 19:30 UTC). We need the current local wall-clock time in the same
    # representation so comparisons work correctly.
    def local_seconds_since_midnight
      local_now = Time.current.in_time_zone(business_timezone)
      local_now.seconds_since_midnight
    end

    def business_timezone
      "Guam"
    end

    def validate_clock_in_time(now, schedule)
      buffer = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i
      scheduled_start = schedule.start_time

      earliest_allowed = scheduled_start.seconds_since_midnight - (buffer * 60)
      current_seconds = local_seconds_since_midnight

      if current_seconds < earliest_allowed
        formatted_start = schedule.formatted_start_time
        errors_msg = "Your shift starts at #{formatted_start}. You can clock in starting at #{buffer} minutes before."
        raise ClockError, errors_msg
      end
    end

    def calculate_attendance_status(now, schedule)
      current_seconds = local_seconds_since_midnight
      scheduled_start_seconds = schedule.start_time.seconds_since_midnight
      buffer_seconds = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i * 60

      if current_seconds < scheduled_start_seconds
        "early"
      elsif current_seconds <= scheduled_start_seconds + buffer_seconds
        "on_time"
      else
        "late"
      end
    end

    def check_overtime_status(user, entry)
      daily_threshold = (Setting.get("overtime_daily_threshold_hours") || "8").to_f
      weekly_threshold = (Setting.get("overtime_weekly_threshold_hours") || "40").to_f

      daily_hours = hours_today(user, entry.work_date) + entry.hours
      weekly_hours = hours_this_week(user, entry.work_date) + entry.hours

      if daily_hours > daily_threshold || weekly_hours > weekly_threshold
        "pending"
      else
        "none"
      end
    end

    def can_clock_in?(user, schedule)
      info = can_clock_in_info(user, schedule)
      info[:allowed]
    end

    def can_clock_in_info(user, schedule)
      return { allowed: false, reason: "already_clocked_in" } if active_entry_for(user)
      return { allowed: false, reason: "no_schedule" } unless schedule

      buffer = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i
      earliest_allowed = schedule.start_time.seconds_since_midnight - (buffer * 60)
      current_seconds = local_seconds_since_midnight

      if current_seconds >= earliest_allowed
        { allowed: true, reason: nil }
      else
        minutes_until = ((earliest_allowed - current_seconds) / 60).ceil
        { allowed: false, reason: "too_early", minutes_until: minutes_until }
      end
    end
  end
end
