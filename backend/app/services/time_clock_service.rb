# frozen_string_literal: true

class TimeClockService
  BUSINESS_TIMEZONE = "Guam"
  # The approval note on a clock-in without a schedule. Entries whose only
  # note is this one can be approved in bulk ("Approve unscheduled-only").
  UNSCHEDULED_NOTE = "Clocked in without a schedule"
  # Approval note when an admin completes an entry left clocked in with an
  # end time (mark_stuck_entry_completed).
  STUCK_COMPLETED_NOTE = "Marked completed by an admin: it was left clocked in with an end time"

  # Optional work details staff can add when clocking out (same fields as a
  # manual entry: client, category, task, period). A key that is present
  # replaces the stored value (blank clears it); an omitted key is kept.
  CLOCK_OUT_WORK_FIELDS = %i[client_id service_type_id service_task_id period_type period_start].freeze

  class ClockError < StandardError; end
  class AuthorizationError < StandardError; end
  # The entry's date is in a locked time period.
  class PeriodLockedError < ClockError; end

  class << self
    # ── Clock In ──
    def clock_in(user:, admin_override_by: nil)
      now = Time.current
      guam_now = now.in_time_zone(business_timezone)
      today = guam_now.to_date

      raise ClockError, "You are already clocked in" if active_entry_for(user)

      schedule = Schedule.for_user(user.id).for_date(today).order(created_at: :desc).first

      if schedule && !admin_override_by
        validate_clock_in_time(now, schedule)
      end

      # Recorded whatever the person's Flexible hours flag says; clock-out
      # decides approval from it and the flag at that moment.
      unscheduled = schedule.nil? && admin_override_by.nil?

      entry = TimeEntry.new(
        user: user,
        work_date: today,
        start_time: guam_now,
        clock_in_at: now,
        entry_method: "clock",
        status: "clocked_in",
        hours: 0,
        schedule: schedule,
        admin_override: admin_override_by.present?,
        approval_status: nil,
        unscheduled_clock_in: unscheduled,
        approval_note: nil,
        attendance_status: schedule ? calculate_attendance_status(now, schedule) : nil
      )

      entry.save!
      entry
    rescue ActiveRecord::RecordNotUnique
      raise ClockError, "You are already clocked in"
    end

    # ── Clock Out ──
    # expected_entry_id: the active entry the clock-out form was opened for.
    # When given, a different (or no) active entry is rejected unchanged.
    # work_lines: optional split of the session's time across clients (see
    # TimeEntry#work_lines_input). The clock keeps running while the form is
    # open, so lines within a few minutes of the final duration are scaled to
    # it exactly.
    def clock_out(user:, admin_override_by: nil, corrected_end_time: nil, description: nil, work_details: {}, expected_entry_id: nil, work_lines: nil)
      entry = active_entry_for(user)
      raise ClockError, "Not currently clocked in" unless entry
      ensure_expected_entry!(entry, expected_entry_id)

      ActiveRecord::Base.transaction do
        # Re-read under a row lock so two clock-outs cannot both complete it
        # (and its work lines are read only while the lock is held).
        entry.lock_for_work_lines!
        raise ClockError, "This clock-in has already ended. Refresh to see your current status." unless entry.active?

        if entry.status == "on_break"
          locked_active_break(entry)&.close!
        end

        now = Time.current
        guam_now = now.in_time_zone(business_timezone)

        # Unscheduled time goes to approval unless the person is on flexible
        # hours now (switching the flag mid-shift counts, either way).
        # Corrected times and overtime go to approval regardless.
        unscheduled_review = unscheduled_needs_approval?(entry, user)
        entry.approval_note = without_unscheduled_note(entry.approval_note)
        if unscheduled_review
          entry.approval_note = build_approval_note(UNSCHEDULED_NOTE, entry.approval_note)
          entry.approval_status = "pending"
        end

        if corrected_end_time.present?
          begin
            parsed = ActiveSupport::TimeZone[business_timezone].parse(corrected_end_time)
          rescue ArgumentError
            raise ClockError, "Invalid corrected time format"
          end
          if parsed <= entry.start_time.in_time_zone(business_timezone)
            raise ClockError, "Corrected time (#{parsed.strftime('%I:%M %p')}) must be after your clock-in time (#{entry.start_time.in_time_zone(business_timezone).strftime('%I:%M %p')})"
          end
          if parsed > guam_now
            raise ClockError, "Corrected time (#{parsed.strftime('%I:%M %p')}) cannot be in the future"
          end
          entry.end_time = parsed
          entry.clock_out_at = now
          entry.approval_status = "pending"
          entry.approval_note = build_approval_note(entry.approval_note, "Employee corrected clock-out time to #{parsed.strftime('%I:%M %p')}")
        else
          entry.end_time = guam_now
          entry.clock_out_at = now
        end

        entry.description = description if description.present?
        apply_clock_out_work_details(entry, work_details)
        entry.enforce_work_requirement = true
        unless work_lines.nil?
          entry.work_lines_input = work_lines
          entry.work_lines_tolerance_minutes = WorkLineHours::CLOCK_OUT_TOLERANCE_MINUTES
        end
        entry.status = "completed"
        entry.break_minutes = entry.total_break_minutes
        entry.calculate_hours_from_times
        entry.overtime_status = check_overtime_status(user, entry)
        entry.admin_override = true if admin_override_by.present?

        unless entry.save
          raise ClockError, entry.errors.full_messages.to_sentence
        end
      end

      entry
    rescue ActiveRecord::InvalidForeignKey
      raise ClockError, "The selected client, category or task no longer exists. Choose another and try again."
    end

    # ── Start Break ──
    # Lock order for every break operation: the time entry first, then its
    # break, with the status re-checked after the locks (clock-out and the
    # stale auto-close use the same order, so they cannot deadlock).
    def start_break(user:, admin_override_by: nil)
      entry = active_entry_for(user)
      raise ClockError, "You are not currently clocked in" unless entry

      ActiveRecord::Base.transaction do
        entry.lock_for_work_lines!
        raise ClockError, "You are not currently clocked in" unless entry.active?
        raise ClockError, "You are already on a break" if entry.status == "on_break"

        now = Time.current
        entry.time_entry_breaks.create!(start_time: now)
        entry.admin_override = true if admin_override_by.present?
        entry.update!(status: "on_break")
      end

      entry
    rescue ActiveRecord::RecordNotUnique
      raise ClockError, "You are already on a break"
    end

    # ── End Break ──
    def end_break(user:, admin_override_by: nil)
      entry = active_entry_for(user)
      raise ClockError, "You are not currently clocked in" unless entry

      ActiveRecord::Base.transaction do
        entry.lock_for_work_lines!
        raise ClockError, "You are not currently clocked in" unless entry.active?
        raise ClockError, "You are not currently on a break" unless entry.status == "on_break"

        active_break = locked_active_break(entry)
        raise ClockError, "No active break found" unless active_break

        active_break.close!
        entry.admin_override = true if admin_override_by.present?
        entry.update!(status: "clocked_in")
      end

      entry
    end

    # ── Current Status ──
    def current_status(user:)
      entry = active_entry_for(user)
      today = Time.current.in_time_zone(business_timezone).to_date
      schedule = Schedule.for_user(user.id).for_date(today).order(created_at: :desc).first

      clock_in_info = can_clock_in_info(user, schedule, existing_entry: entry)

      {
        clocked_in: entry.present?,
        status: entry&.status,
        entry_id: entry&.id,
        work_date: entry&.work_date&.iso8601,
        # Saved work details, so the clock-out form starts from them.
        work_details: entry ? {
          client: entry.client && { id: entry.client.id, name: entry.client.display_name },
          service_type: entry.service_type && { id: entry.service_type.id, name: entry.service_type.name },
          service_task: entry.service_task && { id: entry.service_task.id, name: entry.service_task.name },
          time_category: entry.time_category && { id: entry.time_category.id, name: entry.time_category.name },
          period_type: entry.period_type,
          period_start: entry.period_start&.iso8601,
          description: entry.description
        } : nil,
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
        # From this date, every work line needs a client and a category.
        work_details_required_from: TimeEntryWorkRequirement.cutover_date&.iso8601,
        work_task_required: TimeEntryWorkRequirement.task_required?,
        # Unscheduled clock-ins by people on flexible hours skip approval.
        flexible_hours: user.flexible_hours?,
        can_clock_in: clock_in_info[:allowed],
        clock_in_blocked_reason: clock_in_info[:reason],
        minutes_until: clock_in_info[:minutes_until]
      }
    end

    # ── Admin: Approve Entry ──
    def approve_entry(entry:, approved_by:, note: nil)
      raise AuthorizationError, "Only admins can approve entries" unless approved_by.admin?

      entry.transaction do
        # Owner before entry, like the bulk approvals: the overtime check below
        # reads the person's approved hours (see lock_entry_owners!).
        User.where(id: entry.user_id).lock(User::ROW_MUTEX).pluck(:id)
        entry.lock_for_work_lines!
        raise ClockError, "Entry is not pending approval" unless entry.pending_approval?

        requirement_errors = TimeEntryWorkRequirement.errors_for(entry)
        if requirement_errors.any?
          raise ClockError, "This entry can't be approved yet: #{requirement_errors.to_sentence}. Edit its work lines first."
        end

        combined_note = build_approval_note(entry.approval_note, note)
        attrs = {
          approval_status: "approved",
          approved_by: approved_by,
          approved_at: Time.current,
          approval_note: combined_note
        }

        if entry.status == "completed" && entry.overtime_status.in?([ nil, "none" ])
          attrs[:overtime_status] = check_overtime_status(entry.user, entry)
        end

        entry.update!(attrs)
      end
      entry
    end

    # ── Admin: Deny Entry ──
    # ── Admin: Mark a stuck entry completed ──
    # For an entry left clocked in with an end time (TimeEntry.stuck_clocked_in).
    # Completes it with that end time (an open break is closed at it), so its
    # hours come from its own times, and sends it to approval with a note.
    # Entry lock first; the version bump and audit row happen in the same
    # transaction.
    def mark_stuck_entry_completed(entry:, by:, expected_version: nil)
      raise AuthorizationError, "Only admins can mark entries completed" unless by&.admin?

      entry.transaction do
        # Same order as bulk approval: the period-lock guard (which locking a
        # period also takes), then the entry. A period locked after the
        # controller's early check is either waited for or seen here.
        TimePeriodLock.serialize_with_approvals!
        entry.lock_for_work_lines!
        if TimePeriodLock.locked_for_date?(entry.work_date)
          raise PeriodLockedError, "This time period is locked. Unlock it to mark the entry completed."
        end
        if expected_version && entry.work_version != expected_version
          raise ClockError, "This entry changed since you loaded it. Refresh and try again."
        end
        raise ClockError, "Only an entry still clocked in with an end time can be marked completed" unless entry.active? && entry.end_time.present?

        before = { status: entry.status, approval_status: entry.approval_status, hours: entry.hours.to_f }
        ended_at = stuck_entry_end_at(entry)
        if (open_break = locked_active_break(entry))
          raise ClockError, "Its open break starts after the end time; edit the entry instead" if open_break.start_time >= ended_at

          open_break.close!(ended_at)
        end

        entry.status = "completed"
        entry.clock_out_at = ended_at
        entry.break_minutes = entry.total_break_minutes
        entry.calculate_hours_from_times
        entry.approval_status = "pending"
        entry.approved_by = nil
        entry.approved_at = nil
        entry.approval_note = build_approval_note(entry.approval_note, STUCK_COMPLETED_NOTE)
        entry.overtime_status = check_overtime_status(entry.user, entry)
        entry.save!

        AuditLog.log(
          auditable: entry, action: "updated", user: by,
          changes_made: {
            "status" => { from: before[:status], to: "completed" },
            "approval_status" => { from: before[:approval_status], to: "pending" },
            "hours" => { from: before[:hours], to: entry.hours.to_f }
          },
          metadata: "Marked completed (was left clocked in with an end time)"
        )
      end
      entry
    end

    # Note: approved_by/approved_at store the acting admin for both approvals
    # and denials. The approval_status field distinguishes the action taken.
    def deny_entry(entry:, denied_by:, note: nil)
      raise AuthorizationError, "Only admins can deny entries" unless denied_by.admin?

      entry.transaction do
        entry.lock_for_work_lines!
        raise ClockError, "Entry is not pending approval" unless entry.pending_approval?

        combined_note = build_approval_note(entry.approval_note, note)
        entry.update!(
          approval_status: "denied",
          approved_by: denied_by,
          approved_at: Time.current,
          approval_note: combined_note
        )
      end
      entry
    end

    # ── Admin: Approve Overtime ──
    def approve_overtime(entry:, approved_by:, note: nil)
      raise AuthorizationError, "Only admins can approve overtime" unless approved_by.admin?

      entry.transaction do
        entry.lock_for_work_lines!
        raise ClockError, "Entry does not have pending overtime" unless entry.overtime_status == "pending"

        entry.update!(
          overtime_status: "approved",
          overtime_approved_by: approved_by,
          overtime_approved_at: Time.current,
          overtime_note: note
        )
      end
      entry
    end

    # ── Admin: Deny Overtime ──
    def deny_overtime(entry:, denied_by:, note: nil)
      raise AuthorizationError, "Only admins can deny overtime" unless denied_by.admin?

      entry.transaction do
        entry.lock_for_work_lines!
        raise ClockError, "Entry does not have pending overtime" unless entry.overtime_status == "pending"

        entry.update!(
          overtime_status: "denied",
          overtime_approved_by: denied_by,
          overtime_approved_at: Time.current,
          overtime_note: note
        )
      end
      entry
    end

    # ── Helpers ──

    # The open break, row-locked. Call only after the entry is locked.
    # end_time is a time of day; the moment it names is on the work date in
    # Guam, or the next day when it is not after the clock-in.
    def stuck_entry_end_at(entry)
      tz = ActiveSupport::TimeZone[business_timezone]
      seconds = entry.end_time.in_time_zone(tz).seconds_since_midnight
      ended_at = tz.local(entry.work_date.year, entry.work_date.month, entry.work_date.day) + seconds
      started_at = entry.clock_in_at || tz.local(entry.work_date.year, entry.work_date.month, entry.work_date.day) +
                                        entry.start_time.in_time_zone(tz).seconds_since_midnight
      ended_at += 1.day if ended_at <= started_at
      ended_at
    end

    def locked_active_break(entry)
      entry.time_entry_breaks.active.order(:id).lock.first
    end

    def ensure_expected_entry!(entry, expected_entry_id)
      return if expected_entry_id.blank?
      return if entry.id == expected_entry_id.to_i

      raise ClockError, "Your clock-in changed since this form was opened. Refresh and try again."
    end

    def apply_clock_out_work_details(entry, work_details)
      details = work_details.to_h.symbolize_keys.slice(*CLOCK_OUT_WORK_FIELDS).transform_values(&:presence)
      return if details.empty?

      # A new category without a task drops the old task from the old category.
      if details.key?(:service_type_id) && !details.key?(:service_task_id) &&
         details[:service_type_id].to_s != entry.service_type_id.to_s
        details[:service_task_id] = nil
      end
      details[:service_task_id] = nil if details.key?(:service_type_id) && details[:service_type_id].nil?

      entry.assign_attributes(details)
    end

    def active_entry_for(user)
      TimeEntry.clocked_in.for_user(user).order(created_at: :desc).first
    end

    def flag_stale_entries(threshold_hours: 12)
      cutoff = threshold_hours.hours.ago
      # An open entry that already has an end time isn't closed here: that
      # would replace its real end time with now. Admins mark it completed.
      stale = TimeEntry.clocked_in.where(end_time: nil).where("clock_in_at < ?", cutoff)
      count = stale.count

      stale.find_each do |entry|
        begin
          ActiveRecord::Base.transaction do
            # A clock-out may have completed it since the query above.
            entry.lock_for_work_lines!
            next unless entry.active?

            if entry.status == "on_break"
              locked_active_break(entry)&.close!
            end

            guam_now = Time.current.in_time_zone(business_timezone)
            entry.end_time = guam_now
            entry.clock_out_at = Time.current
            entry.calculate_hours_from_times
            entry.update!(
              end_time: entry.end_time,
              clock_out_at: entry.clock_out_at,
              hours: entry.hours,
              status: "completed",
              break_minutes: entry.total_break_minutes,
              admin_override: true,
              approval_status: "pending",
              approval_note: build_approval_note(
                unscheduled_needs_approval?(entry, entry.user) ? build_approval_note(UNSCHEDULED_NOTE, without_unscheduled_note(entry.approval_note)) : without_unscheduled_note(entry.approval_note),
                "Auto-closed: clocked in for over #{threshold_hours} hours without clocking out"
              )
            )

            AuditLog.create!(
              auditable: entry,
              action: "updated",
              user: nil,
              metadata: "System auto-closed stale time entry (>#{threshold_hours}h) for #{entry.user&.full_name}"
            )
          end
        rescue StandardError => e
          Rails.logger.error("Failed to auto-close stale entry #{entry.id}: #{e.message}")
        end
      end

      count
    end

    def hours_today(user, date = Date.current)
      TimeEntry.countable.for_user(user).for_date(date).sum(:hours).to_f
    end

    def hours_this_week(user, date = Date.current)
      TimeEntry.countable.for_user(user).for_week(date).sum(:hours).to_f
    end

    # Evaluates whether an entry triggers overtime thresholds.
    # include_entry_hours: true when entry is unsaved (clock_out flow),
    # false when entry is already persisted (edit flow) to avoid double-counting.
    def check_overtime_status(user, entry, include_entry_hours: true)
      daily_threshold = (Setting.get("overtime_daily_threshold_hours") || "8").to_f
      weekly_threshold = (Setting.get("overtime_weekly_threshold_hours") || "40").to_f

      daily_hours = hours_today(user, entry.work_date)
      weekly_hours = hours_this_week(user, entry.work_date)

      if include_entry_hours
        daily_hours += entry.hours
        weekly_hours += entry.hours
      end

      if daily_hours > daily_threshold || weekly_hours > weekly_threshold
        "pending"
      else
        "none"
      end
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
      BUSINESS_TIMEZONE
    end

    # Unscheduled is the recorded flag, or the legacy note: a clock-in written
    # by the previous release during the deploy has the note but not the flag
    # (the migration only backfills rows that existed when it ran).
    def unscheduled_needs_approval?(entry, user)
      unscheduled = entry.unscheduled_clock_in? || legacy_unscheduled_note?(entry.approval_note)
      unscheduled && !user&.flexible_hours?
    end

    def legacy_unscheduled_note?(note)
      note.to_s.split(" | ").map(&:strip).include?(UNSCHEDULED_NOTE)
    end

    # Clock-ins before unscheduled_clock_in existed wrote the note at clock-in;
    # clock-out now decides it, so drop any such note before deciding.
    def without_unscheduled_note(note)
      return nil if note.blank?

      note.split(" | ").map(&:strip).reject { |part| part == UNSCHEDULED_NOTE }.join(" | ").presence
    end

    def build_approval_note(existing_note, new_note)
      [ existing_note.presence, new_note.presence ]
        .compact
        .flat_map { |note| note.split(" | ").map(&:strip) }
        .reject(&:blank?)
        .uniq
        .join(" | ")
        .presence
    end

    def validate_clock_in_time(now, schedule)
      buffer = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i

      earliest_allowed = [ schedule.start_time.utc.seconds_since_midnight - (buffer * 60), 0 ].max
      latest_allowed = schedule.end_time.utc.seconds_since_midnight
      current_seconds = now.in_time_zone(business_timezone).seconds_since_midnight

      if current_seconds < earliest_allowed
        formatted_start = schedule.formatted_start_time
        errors_msg = "Your shift starts at #{formatted_start}. You can clock in starting at #{buffer} minutes before."
        raise ClockError, errors_msg
      end

      if latest_allowed > earliest_allowed && current_seconds > latest_allowed
        formatted_end = schedule.formatted_end_time
        raise ClockError, "Your shift ended at #{formatted_end}. Please submit a manual entry if you need to log time."
      end
    end

    def calculate_attendance_status(now, schedule)
      current_seconds = now.in_time_zone(business_timezone).seconds_since_midnight
      scheduled_start_seconds = schedule.start_time.utc.seconds_since_midnight
      buffer_seconds = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i * 60

      if current_seconds < scheduled_start_seconds
        "early"
      elsif current_seconds <= scheduled_start_seconds + buffer_seconds
        "on_time"
      else
        "late"
      end
    end

    def can_clock_in_info(user, schedule, existing_entry: nil)
      active = existing_entry.nil? ? active_entry_for(user) : existing_entry
      return { allowed: false, reason: "already_clocked_in" } if active
      return { allowed: true, reason: "no_schedule" } unless schedule

      buffer = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i
      earliest_allowed = [ schedule.start_time.utc.seconds_since_midnight - (buffer * 60), 0 ].max
      latest_allowed = schedule.end_time.utc.seconds_since_midnight
      current_seconds = local_seconds_since_midnight

      if latest_allowed > earliest_allowed && current_seconds > latest_allowed
        { allowed: false, reason: "shift_ended" }
      elsif current_seconds >= earliest_allowed
        { allowed: true, reason: nil }
      else
        minutes_until = ((earliest_allowed - current_seconds) / 60).ceil
        { allowed: false, reason: "too_early", minutes_until: minutes_until }
      end
    end
  end
end
