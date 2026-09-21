# frozen_string_literal: true

require "bigdecimal"

namespace :employment do
  desc "Recover an explicitly identified legacy-deleted employee and relink preserved history"
  task recover_legacy_deleted_employee: :environment do
    required = %w[EMAIL CLERK_ID FIRST_NAME LAST_NAME TIME_ENTRY_IDS SCHEDULE_IDS EXPECTED_HOURS]
    missing = required.select { |name| ENV[name].blank? }
    abort "Missing required environment variables: #{missing.join(', ')}" if missing.any?

    parse_ids = lambda do |name|
      ids = ENV.fetch(name).split(",").map(&:strip).reject(&:blank?).map do |value|
        Integer(value, 10)
      rescue ArgumentError
        abort "#{name} contains an invalid id: #{value.inspect}"
      end
      abort "#{name} must not contain duplicate ids" unless ids.uniq.length == ids.length
      ids
    end

    entry_ids = parse_ids.call("TIME_ENTRY_IDS")
    schedule_ids = parse_ids.call("SCHEDULE_IDS")
    expected_hours = BigDecimal(ENV.fetch("EXPECTED_HOURS"))
    email = ENV.fetch("EMAIL").downcase.strip
    clerk_id = ENV.fetch("CLERK_ID").strip
    effective_on = ENV["TERMINATION_EFFECTIVE_ON"].present? ? Date.iso8601(ENV.fetch("TERMINATION_EFFECTIVE_ON")) : nil
    reason = ENV["TERMINATION_REASON"].presence || "Recovered after legacy hard deletion; original termination details were not recorded"

    existing_by_email = User.find_by("LOWER(email) = ?", email)
    existing_by_clerk = User.find_by(clerk_id: clerk_id)
    if existing_by_email && existing_by_clerk && existing_by_email.id != existing_by_clerk.id
      abort "EMAIL and CLERK_ID resolve to different users"
    end
    employee = existing_by_email || existing_by_clerk
    abort "Existing user is active; refusing to mutate it" if employee&.employment_active?

    entries = TimeEntry.where(id: entry_ids).order(:id).to_a
    schedules = Schedule.where(id: schedule_ids).order(:id).to_a
    abort "Expected #{entry_ids.length} time entries, found #{entries.length}" unless entries.length == entry_ids.length
    abort "Expected #{schedule_ids.length} schedules, found #{schedules.length}" unless schedules.length == schedule_ids.length

    allowed_user_ids = [ nil, employee&.id ]
    conflicting_entries = entries.reject { |entry| allowed_user_ids.include?(entry.user_id) }
    conflicting_schedules = schedules.reject { |schedule| allowed_user_ids.include?(schedule.user_id) }
    abort "Time entries already belong to another user: #{conflicting_entries.map(&:id).join(',')}" if conflicting_entries.any?
    abort "Schedules already belong to another user: #{conflicting_schedules.map(&:id).join(',')}" if conflicting_schedules.any?

    actual_hours = entries.sum { |entry| BigDecimal(entry.hours.to_s) }
    abort "Expected #{expected_hours.to_s('F')} hours, found #{actual_hours.to_s('F')}" unless actual_hours == expected_hours

    mode = ENV["APPLY"] == "true" ? "APPLY" : "DRY RUN"
    puts "#{mode}: #{email}"
    puts "Time entries: #{entries.length} (#{actual_hours.to_s('F')} hours)"
    puts "Schedules: #{schedules.length}"
    puts "Termination effective date: #{effective_on&.iso8601 || 'not recorded'}"

    unless ENV["APPLY"] == "true"
      puts "No changes made. Re-run with APPLY=true after reviewing this output."
      next
    end

    ActiveRecord::Base.transaction do
      employee ||= User.create!(
        email: email,
        clerk_id: clerk_id,
        first_name: ENV.fetch("FIRST_NAME").strip,
        last_name: ENV.fetch("LAST_NAME").strip,
        role: "employee",
        employment_status: "terminated",
        termination_effective_on: effective_on,
        terminated_at: Time.current,
        termination_reason: reason
      )

      entries.select { |entry| entry.user_id.nil? }.each { |entry| entry.update!(user: employee) }
      schedules.select { |schedule| schedule.user_id.nil? }.each { |schedule| schedule.update!(user: employee) }

      AuditLog.log(
        auditable: employee,
        action: "updated",
        changes_made: {
          recovered_time_entry_ids: entry_ids,
          recovered_schedule_ids: schedule_ids,
          recovered_hours: actual_hours.to_s("F")
        },
        metadata: "Legacy employee profile recovered; historical records relinked"
      )

      unless employee.time_entries.where(id: entry_ids).count == entry_ids.length
        raise "Time-entry relink verification failed; transaction rolled back"
      end
      unless employee.schedules.where(id: schedule_ids).count == schedule_ids.length
        raise "Schedule relink verification failed; transaction rolled back"
      end
    end

    employee.reload
    abort "Recovery did not persist" unless employee.terminated?
    puts "Recovery complete: user_id=#{employee.id}, status=#{employee.employment_status}"
  rescue Date::Error
    abort "TERMINATION_EFFECTIVE_ON must be a valid ISO 8601 date (YYYY-MM-DD)"
  rescue ArgumentError => e
    abort e.message
  end
end
