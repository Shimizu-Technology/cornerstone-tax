# frozen_string_literal: true

require "set"

class WhosWorkingQuery
  class << self
    def call
      today = Time.current.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).to_date
      staff_users = User.staff.order(:first_name, :last_name).to_a
      staff_ids = staff_users.map(&:id)

      today_schedules = Schedule.where(user_id: staff_ids, work_date: today).index_by(&:user_id)

      all_today_entries = TimeEntry.where(user_id: staff_ids, work_date: today)
                                   .eager_load(:time_entry_breaks, :time_category)
                                   .order(:start_time, :created_at, :id)
                                   .to_a
      clock_entries = all_today_entries.select(&:clock_entry?)

      entries_by_user = all_today_entries.group_by(&:user_id)
      clocked_out_user_ids = clock_entries.select { |entry| entry.status == "completed" }.map(&:user_id).to_set
      active_entries_by_user = clock_entries.select { |entry| %w[clocked_in on_break].include?(entry.status) }
                                            .index_by(&:user_id)

      buffer_seconds = (Setting.get("early_clock_in_buffer_minutes") || "5").to_i * 60

      staff_users.map do |user|
        schedule = today_schedules[user.id]
        active_entry = active_entries_by_user[user.id]
        user_entries = entries_by_user[user.id] || []
        countable_entries = user_entries.select(&:counts_toward_hours?)
        clock_user_entries = user_entries.select(&:clock_entry?)
        hours = countable_entries.sum { |entry| entry.hours.to_f }.round(2)

        active_break_record = active_entry&.active_break
        elapsed_hours = calculate_elapsed(active_entry, active_break_record)
        latest_entry = active_entry || user_entries.last
        all_breaks = user_entries.flat_map { |entry| serialize_breaks(entry) }.sort_by { |entry_break| entry_break[:start_time] }
        total_break_min = user_entries.sum(&:total_break_minutes)

        {
          user: {
            id: user.id,
            full_name: user.full_name,
            display_name: user.display_name,
            email: user.email
          },
          schedule: schedule ? {
            start_time: schedule.formatted_start_time,
            end_time: schedule.formatted_end_time,
            hours: schedule.hours
          } : nil,
          status: resolve_status(active_entry, clocked_out_user_ids, user, schedule, buffer_seconds),
          clock_in_at: clock_user_entries.first&.clock_in_at&.iso8601,
          clock_out_at: (active_entry&.clock_out_at || clock_user_entries.select { |entry| entry.status == "completed" }.last&.clock_out_at)&.iso8601,
          completed_hours: (hours + elapsed_hours).round(2),
          active_break: active_break_record.present?,
          break_started_at: active_break_record&.start_time&.iso8601,
          total_break_minutes: total_break_min,
          breaks: all_breaks,
          time_category: serialize_time_category(latest_entry),
          day_entries: user_entries.map { |entry| serialize_day_entry(entry) }
        }
      end
    end

    private

    def calculate_elapsed(active_entry, active_break_record)
      return 0.0 unless active_entry&.clock_in_at

      elapsed = (Time.current - active_entry.clock_in_at) / 3600.0
      completed_break_hours = (active_entry.total_break_minutes || 0) / 60.0
      active_break_hours = active_break_record&.start_time ? (Time.current - active_break_record.start_time) / 3600.0 : 0.0
      (elapsed - completed_break_hours - active_break_hours).clamp(0, Float::INFINITY).round(2)
    end

    def resolve_status(active_entry, clocked_out_user_ids, user, schedule, buffer_seconds)
      if active_entry
        active_entry.status
      elsif clocked_out_user_ids.include?(user.id)
        "clocked_out"
      elsif schedule
        guam_now = Time.current.in_time_zone(TimeClockService::BUSINESS_TIMEZONE)
        shift_start_seconds = schedule.start_time.utc.seconds_since_midnight
        shift_end_seconds = schedule.end_time.utc.seconds_since_midnight
        current_seconds = guam_now.seconds_since_midnight
        if current_seconds > shift_end_seconds && shift_end_seconds > shift_start_seconds
          "no_show"
        elsif current_seconds > shift_start_seconds + buffer_seconds
          "late"
        else
          "not_clocked_in"
        end
      else
        "no_schedule"
      end
    end

    def serialize_breaks(entry)
      return [] unless entry

      breaks = if entry.time_entry_breaks.loaded?
        entry.time_entry_breaks.sort_by(&:start_time)
      else
        entry.time_entry_breaks.order(:start_time)
      end

      breaks.map do |entry_break|
        {
          start_time: entry_break.start_time.iso8601,
          end_time: entry_break.end_time&.iso8601,
          duration_minutes: entry_break.duration_minutes,
          active: entry_break.active?
        }
      end
    end

    def serialize_time_category(entry)
      return nil unless entry&.time_category

      {
        id: entry.time_category.id,
        name: entry.time_category.name
      }
    end

    def serialize_day_entry(entry)
      {
        id: entry.id,
        status: entry.status,
        clock_in_at: entry.clock_in_at&.iso8601,
        clock_out_at: entry.clock_out_at&.iso8601,
        entry_method: entry.entry_method,
        hours: entry.hours.to_f.round(2),
        time_category: serialize_time_category(entry),
        breaks: serialize_breaks(entry)
      }
    end
  end
end
