# frozen_string_literal: true

require "set"

module Payroll
  class HoursReportBuilder
    BUSINESS_TIMEZONE = TimeClockService::BUSINESS_TIMEZONE
    MAX_RANGE_DAYS = 62

    attr_reader :params, :start_date, :end_date, :context_start_date, :context_end_date,
                :daily_overtime_threshold, :weekly_overtime_threshold

    def initialize(params = {})
      @params = params
      @start_date = parse_date!(params[:start_date], "start_date")
      @end_date = parse_date!(params[:end_date], "end_date")
      raise ArgumentError, "end_date must be on or after start_date" if @end_date < @start_date
      raise ArgumentError, "date range may not exceed #{MAX_RANGE_DAYS} days" if (@end_date - @start_date).to_i > MAX_RANGE_DAYS

      @context_start_date = @start_date.beginning_of_week(:sunday)
      @context_end_date = @end_date.end_of_week(:sunday)
      @daily_overtime_threshold = (Setting.get("overtime_daily_threshold_hours") || "8").to_f
      @weekly_overtime_threshold = (Setting.get("overtime_weekly_threshold_hours") || "40").to_f
    end

    def call
      scoped_users = users_scope.to_a
      user_ids = scoped_users.map(&:id)
      overtime_context_entries = overtime_context_entries_scope(context_start_date..context_end_date, user_ids).to_a
      report_entries = report_entries_scope(context_start_date..context_end_date, user_ids).to_a
      period_entries = report_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
      employees = build_employee_reports(scoped_users, overtime_context_entries, report_entries)

      {
        start_date: start_date.iso8601,
        end_date: end_date.iso8601,
        context_start_date: context_start_date.iso8601,
        context_end_date: context_end_date.iso8601,
        generated_at: Time.current.iso8601,
        filters: serialized_filters,
        overtime_policy: {
          daily_threshold_hours: daily_overtime_threshold,
          weekly_threshold_hours: weekly_overtime_threshold
        },
        summary: summary(employees, period_entries),
        employees: employees
      }
    end

    private

    def parse_date!(value, name)
      raise ArgumentError, "#{name} is required" if value.blank?

      Date.iso8601(value.to_s)
    rescue Date::Error
      raise ArgumentError, "#{name} must be a valid ISO 8601 date (YYYY-MM-DD)"
    end

    def users_scope
      scope = User.staff.order(:last_name, :first_name, :email, :id)
      scope = scope.where(id: params[:user_id]) if params[:user_id].present?
      scope = scope.where(role: params[:role]) if params[:role].present? && %w[admin employee].include?(params[:role].to_s)

      case params[:status].to_s
      when "active"
        scope = scope.where.not("clerk_id LIKE 'pending_%'")
      when "pending"
        scope = scope.where("clerk_id LIKE 'pending_%'")
      end

      scope
    end

    def overtime_context_entries_scope(range, user_ids)
      base_entries_scope(range, user_ids)
    end

    def report_entries_scope(range, user_ids)
      scope = base_entries_scope(range, user_ids)
      scope = scope.where(time_category_id: params[:time_category_id]) if params[:time_category_id].present?
      scope = scope.where(client_id: params[:client_id]) if params[:client_id].present?
      scope = scope.where(service_type_id: params[:service_type_id]) if params[:service_type_id].present?
      scope = scope.where(service_task_id: params[:service_task_id]) if params[:service_task_id].present?
      scope = scope.where(entry_method: params[:entry_method]) if params[:entry_method].present?
      scope = scope.where(approval_status: approval_status_value(params[:approval_status])) if params[:approval_status].present?
      scope = scope.where(overtime_status: params[:overtime_status]) if params[:overtime_status].present?
      scope
    end

    def base_entries_scope(range, user_ids)
      return TimeEntry.none if user_ids.empty?

      TimeEntry
        .where(user_id: user_ids, work_date: range)
        .includes(:user, :time_category, :time_entry_breaks, :client, :tax_return, :service_type, :service_task)
        .order(:work_date, :start_time, :created_at, :id)
    end

    def approval_status_value(value)
      value.to_s == "approved_or_standard" ? [ "approved", nil ] : value
    end

    def build_employee_reports(users, overtime_context_entries, report_entries)
      context_entries_by_user = overtime_context_entries.group_by(&:user_id)
      report_entries_by_user = report_entries.group_by(&:user_id)

      users.filter_map do |user|
        user_context_entries = context_entries_by_user.fetch(user.id, [])
        user_report_entries = report_entries_by_user.fetch(user.id, [])
        period_entries = user_report_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
        next if period_entries.empty? && !include_empty_employees?

        build_employee_report(user, user_context_entries, user_report_entries)
      end
    end

    def include_empty_employees?
      ActiveModel::Type::Boolean.new.cast(params[:include_empty])
    end

    def build_employee_report(user, user_context_entries, user_report_entries)
      overtime_allocations = allocate_overtime(user_context_entries)
      period_entries = user_report_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
      countable_period_entries = period_entries.select { |entry| countable?(entry) }
      days = build_days(countable_period_entries, overtime_allocations)
      categories = build_categories(countable_period_entries, overtime_allocations)
      clients = build_clients(countable_period_entries, overtime_allocations)
      services = build_services(countable_period_entries, overtime_allocations)
      weeks = build_weeks(user_context_entries, countable_period_entries, overtime_allocations)
      issues = issues_for(period_entries)

      regular_hours = sum(days, :regular_hours)
      overtime_hours = sum(days, :overtime_hours)
      total_hours = sum(days, :total_hours)
      break_hours = round_hours(countable_period_entries.sum { |entry| entry.break_minutes.to_i / 60.0 })

      {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        full_name: user.full_name,
        role: user.role,
        status: user_status(user),
        total_hours: total_hours,
        regular_hours: regular_hours,
        overtime_hours: overtime_hours,
        break_hours: break_hours,
        entries_count: countable_period_entries.size,
        ready: report_ready?(issues),
        issues: issues,
        days: days,
        categories: categories,
        clients: clients,
        services: services,
        weeks: weeks
      }
    end

    # Allocate overtime per entry using both Cornerstone thresholds:
    # - daily hours beyond the daily threshold are overtime
    # - weekly hours beyond the Sunday-Saturday threshold are overtime
    # An hour is counted as overtime once if either threshold applies.
    def allocate_overtime(entries)
      allocations = {}
      countable_entries = entries.select { |entry| countable?(entry) }

      countable_entries.group_by { |entry| entry.work_date.beginning_of_week(:sunday) }.each_value do |week_entries|
        weekly_cumulative = 0.0
        daily_cumulative = Hash.new(0.0)

        week_entries.sort_by { |entry| [ entry.work_date, entry_sort_seconds(entry), entry.created_at, entry.id ] }.each do |entry|
          hours = entry.hours.to_f
          daily_before = daily_cumulative[entry.work_date]
          weekly_before = weekly_cumulative

          daily_regular_remaining = daily_overtime_threshold.positive? ? [ daily_overtime_threshold - daily_before, 0.0 ].max : hours
          weekly_regular_remaining = weekly_overtime_threshold.positive? ? [ weekly_overtime_threshold - weekly_before, 0.0 ].max : hours
          regular = [ hours, daily_regular_remaining, weekly_regular_remaining ].min
          overtime = [ hours - regular, 0.0 ].max

          allocations[entry.id] = {
            regular_hours: round_hours(regular),
            overtime_hours: round_hours(overtime),
            daily_cumulative_before: round_hours(daily_before),
            daily_cumulative_after: round_hours(daily_before + hours),
            weekly_cumulative_before: round_hours(weekly_before),
            weekly_cumulative_after: round_hours(weekly_before + hours)
          }

          daily_cumulative[entry.work_date] += hours
          weekly_cumulative += hours
        end
      end

      allocations
    end

    def build_days(entries, allocations)
      entries.group_by(&:work_date).sort_by { |date, _| date }.map do |date, day_entries|
        regular = day_entries.sum { |entry| allocations.fetch(entry.id, {})[:regular_hours].to_f }
        overtime = day_entries.sum { |entry| allocations.fetch(entry.id, {})[:overtime_hours].to_f }
        {
          work_date: date.iso8601,
          total_hours: round_hours(day_entries.sum { |entry| entry.hours.to_f }),
          regular_hours: round_hours(regular),
          overtime_hours: round_hours(overtime),
          break_hours: round_hours(day_entries.sum { |entry| entry.break_minutes.to_i / 60.0 }),
          entries: day_entries.map { |entry| serialize_entry(entry, allocations.fetch(entry.id, {})) }
        }
      end
    end

    def build_categories(entries, allocations)
      grouped_summary(entries.group_by(&:time_category), allocations) do |category|
        {
          id: category&.id,
          name: category&.name || "Uncategorized"
        }
      end
    end

    def build_clients(entries, allocations)
      grouped_summary(entries.group_by(&:client), allocations) do |client|
        {
          id: client&.id,
          name: client ? [ client.first_name, client.last_name ].compact.join(" ").strip.presence || "Client ##{client.id}" : "No client"
        }
      end
    end

    def build_services(entries, allocations)
      grouped_summary(entries.group_by(&:service_type), allocations) do |service|
        {
          id: service&.id,
          name: service&.name || "No service"
        }
      end
    end

    def grouped_summary(grouped_entries, allocations)
      grouped_entries.map do |group, group_entries|
        regular = group_entries.sum { |entry| allocations.fetch(entry.id, {})[:regular_hours].to_f }
        overtime = group_entries.sum { |entry| allocations.fetch(entry.id, {})[:overtime_hours].to_f }
        yield(group).merge(
          total_hours: round_hours(group_entries.sum { |entry| entry.hours.to_f }),
          regular_hours: round_hours(regular),
          overtime_hours: round_hours(overtime),
          break_hours: round_hours(group_entries.sum { |entry| entry.break_minutes.to_i / 60.0 }),
          entries_count: group_entries.size
        )
      end.sort_by { |row| [ row[:name].to_s, row[:id].to_i ] }
    end

    def build_weeks(context_entries, period_report_entries, allocations)
      report_entry_ids = period_report_entries.map(&:id).to_set

      context_entries.group_by { |entry| entry.work_date.beginning_of_week(:sunday) }.sort_by { |date, _| date }.map do |week_start, week_entries|
        week_end = week_start.end_of_week(:sunday)
        countable = week_entries.select { |entry| countable?(entry) }
        period_entries = countable.select { |entry| report_entry_ids.include?(entry.id) }
        context_entries_for_week = countable.reject { |entry| report_entry_ids.include?(entry.id) }
        next if period_entries.empty?

        context_hours = round_hours(context_entries_for_week.sum { |entry| entry.hours.to_f })
        {
          week_start: week_start.iso8601,
          week_end: week_end.iso8601,
          weekly_total_hours: round_hours(countable.sum { |entry| entry.hours.to_f }),
          period_hours: round_hours(period_entries.sum { |entry| entry.hours.to_f }),
          context_hours: context_hours,
          regular_hours: round_hours(period_entries.sum { |entry| allocations.fetch(entry.id, {})[:regular_hours].to_f }),
          overtime_hours: round_hours(period_entries.sum { |entry| allocations.fetch(entry.id, {})[:overtime_hours].to_f }),
          context_note: context_hours.positive? ? "Includes #{context_hours}h from outside this filtered report selection to calculate Sunday–Saturday overtime." : nil
        }
      end.compact
    end

    def serialize_entry(entry, allocation)
      {
        id: entry.id,
        work_date: entry.work_date.iso8601,
        start_time: entry.start_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
        end_time: entry.end_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
        formatted_start_time: entry.formatted_start_time,
        formatted_end_time: entry.formatted_end_time,
        total_hours: round_hours(entry.hours.to_f),
        regular_hours: allocation[:regular_hours].to_f,
        overtime_hours: allocation[:overtime_hours].to_f,
        break_minutes: entry.break_minutes.to_i,
        description: entry.description,
        entry_method: entry.entry_method,
        approval_status: entry.approval_status,
        overtime_status: entry.overtime_status,
        locked_at: entry.locked_at&.iso8601,
        time_category: entry.time_category ? {
          id: entry.time_category.id,
          name: entry.time_category.name
        } : nil,
        client: entry.client ? {
          id: entry.client.id,
          name: [ entry.client.first_name, entry.client.last_name ].compact.join(" ").strip
        } : nil,
        tax_return: entry.tax_return ? {
          id: entry.tax_return.id,
          tax_year: entry.tax_return.tax_year
        } : nil,
        service_type: entry.service_type ? {
          id: entry.service_type.id,
          name: entry.service_type.name,
          color: entry.service_type.color
        } : nil,
        service_task: entry.service_task ? {
          id: entry.service_task.id,
          name: entry.service_task.name
        } : nil,
        breaks: entry.time_entry_breaks.sort_by(&:start_time).map do |entry_break|
          {
            id: entry_break.id,
            start_time: entry_break.start_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
            end_time: entry_break.end_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
            duration_minutes: entry_break.duration_minutes
          }
        end
      }
    end

    def issues_for(entries)
      {
        pending_count: entries.count { |entry| entry.approval_status == "pending" },
        denied_count: entries.count { |entry| entry.approval_status == "denied" },
        pending_overtime_count: entries.count { |entry| entry.overtime_status == "pending" },
        denied_overtime_count: entries.count { |entry| entry.overtime_status == "denied" },
        open_clock_count: entries.count { |entry| entry.status.in?(%w[clocked_in on_break]) }
      }
    end

    def report_ready?(issues)
      issues.values.all?(&:zero?)
    end

    def summary(employees, period_entries)
      {
        employee_count: employees.size,
        total_hours: sum(employees, :total_hours),
        regular_hours: sum(employees, :regular_hours),
        overtime_hours: sum(employees, :overtime_hours),
        break_hours: sum(employees, :break_hours),
        entries_count: employees.sum { |employee| employee[:entries_count].to_i },
        pending_count: period_entries.count { |entry| entry.approval_status == "pending" },
        denied_count: period_entries.count { |entry| entry.approval_status == "denied" },
        pending_overtime_count: period_entries.count { |entry| entry.overtime_status == "pending" },
        denied_overtime_count: period_entries.count { |entry| entry.overtime_status == "denied" },
        open_clock_count: period_entries.count { |entry| entry.status.in?(%w[clocked_in on_break]) }
      }
    end

    def entry_sort_seconds(entry)
      entry.start_time&.in_time_zone(BUSINESS_TIMEZONE)&.seconds_since_midnight || 0
    end

    def serialized_filters
      params.to_h.slice(:user_id, :role, :status, :time_category_id, :client_id, :service_type_id, :service_task_id, :entry_method, :approval_status, :overtime_status, :include_empty)
    end

    def countable?(entry)
      entry.status == "completed" && !entry.approval_status.in?(%w[denied pending])
    end

    def user_status(user)
      return "pending" if user.clerk_id.blank? || user.clerk_id.start_with?("pending_")

      "active"
    end

    def sum(rows, key)
      round_hours(rows.sum { |row| row[key].to_f })
    end

    def round_hours(value)
      BigDecimal(value.to_s).round(2).to_f
    end
  end
end
