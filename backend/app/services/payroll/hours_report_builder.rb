# frozen_string_literal: true

require "set"

module Payroll
  class HoursReportBuilder
    BUSINESS_TIMEZONE = TimeClockService::BUSINESS_TIMEZONE
    LONG_SHIFT_HOURS = 12
    UNASSIGNED_LABEL = TimeEntryAllocation::UNASSIGNED_LABEL

    # Stand-in for an entry that has no stored work lines yet (an open clock,
    # or data written before lines existed): one line carrying the entry's own
    # work fields and full hours, so reports read the same either way.
    VirtualLine = Struct.new(:entry, keyword_init: true) do
      delegate :client, :client_id, :service_type, :service_type_id, :service_task, :service_task_id,
               :period_type, :period_start, :period_label, :description, :category_label, to: :entry

      def id = nil
      def position = 0
      def hours = entry.hours
      def minutes = (entry.hours.to_d * 60).round.to_i
      def client_label = client ? client.display_name : UNASSIGNED_LABEL
    end

    # One reported slice of time: a work line with its share of the entry's
    # regular and overtime hours.
    Item = Struct.new(:entry, :line, :hours, :regular_hours, :overtime_hours, keyword_init: true)

    attr_reader :params, :start_date, :end_date, :context_start_date, :context_end_date,
                :daily_overtime_threshold, :weekly_overtime_threshold

    def initialize(params = {})
      @params = params
      @start_date = parse_date!(params[:start_date], "start_date")
      @end_date = parse_date!(params[:end_date], "end_date")
      raise ArgumentError, "end_date must be on or after start_date" if @end_date < @start_date

      @context_start_date = @start_date.beginning_of_week(:sunday)
      @context_end_date = @end_date.end_of_week(:sunday)
      @daily_overtime_threshold = (Setting.get("overtime_daily_threshold_hours") || "8").to_f
      @weekly_overtime_threshold = (Setting.get("overtime_weekly_threshold_hours") || "40").to_f
    end

    def call
      TimeEntry.consistent_read { build }
    end

    private

    def build
      scoped_users = users_scope.to_a
      user_ids = scoped_users.map(&:id)
      control_entries = overtime_context_entries_scope(context_start_date..context_end_date, user_ids).to_a
      report_entries = report_entries_scope(context_start_date..context_end_date, user_ids).to_a
      control_period_entries = control_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
      employees = build_employee_reports(scoped_users, control_entries, report_entries)

      quality = aggregate_quality(employees)

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
        ready: report_ready?(issues_for(control_period_entries)),
        quality: quality,
        finalization: finalization_coverage,
        summary: summary(employees, control_period_entries),
        employees: employees
      }
    end


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
        scope = scope.active_employment.where.not("clerk_id LIKE 'pending_%'")
      when "pending"
        scope = scope.active_employment.where("clerk_id LIKE 'pending_%'")
      when "terminated"
        scope = scope.terminated
      end

      scope
    end

    def overtime_context_entries_scope(range, user_ids)
      base_entries_scope(range, user_ids)
    end

    def report_entries_scope(range, user_ids)
      scope = base_entries_scope(range, user_ids)
      scope = scope.where(time_category_id: params[:time_category_id]) if params[:time_category_id].present?
      # Client, category, task and period are work-line filters, applied per
      # line in Ruby (see #included_lines); period_type is validated here.
      period_type_filter
      period_start_filter
      scope = scope.where(entry_method: params[:entry_method]) if params[:entry_method].present?
      scope = scope.where(approval_status: approval_status_value(params[:approval_status])) if params[:approval_status].present?
      scope = scope.where(overtime_status: params[:overtime_status]) if params[:overtime_status].present?
      scope
    end

    def base_entries_scope(range, user_ids)
      return TimeEntry.none if user_ids.empty?

      TimeEntry
        .where(user_id: user_ids, work_date: range)
        .includes(:user, :time_category, :time_entry_breaks, :client, :tax_return, :service_type, :service_task, :approved_by, :overtime_approved_by,
                  work_lines: [ :client, :service_type, :service_task ])
        .order(:work_date, :start_time, :created_at, :id)
    end

    def period_type_filter
      return @period_type_filter if defined?(@period_type_filter)
      return @period_type_filter = nil if params[:period_type].blank?
      raise ArgumentError, "period_type is not supported" unless TimeEntry::PERIOD_TYPES.include?(params[:period_type].to_s)

      @period_type_filter = params[:period_type].to_s
    end

    def period_start_filter
      return @period_start_filter if defined?(@period_start_filter)
      return @period_start_filter = nil if params[:period_start].blank?

      @period_start_filter = parse_date!(params[:period_start], "period_start")
    end

    def approval_status_value(value)
      value.to_s == "approved_or_standard" ? [ "approved", nil ] : value
    end

    def build_employee_reports(users, overtime_context_entries, report_entries)
      context_entries_by_user = overtime_context_entries.group_by(&:user_id)
      report_entries_by_user = report_entries.group_by(&:user_id)

      users.filter_map do |user|
        user_context_entries = context_entries_by_user.fetch(user.id, [])
        user_report_entries = report_entries_by_user.fetch(user.id, []).select { |entry| included_lines(entry).any? }
        period_entries = user_report_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
        control_period_entries = user_context_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
        next if period_entries.empty? && control_period_entries.empty? && !include_empty_employees?

        build_employee_report(user, user_context_entries, user_report_entries, control_period_entries)
      end
    end

    def include_empty_employees?
      ActiveModel::Type::Boolean.new.cast(params[:include_empty])
    end

    def build_employee_report(user, user_context_entries, user_report_entries, control_period_entries)
      overtime_allocations = allocate_overtime(user_context_entries)
      user_report_entries = user_report_entries.select { |entry| included_lines(entry).any? }
      period_entries = user_report_entries.select { |entry| entry.work_date.between?(start_date, end_date) }
      countable_period_entries = period_entries.select { |entry| countable?(entry) }
      items_by_entry = countable_period_entries.to_h { |entry| [ entry.id, items_for(entry, overtime_allocations) ] }
      items = items_by_entry.values.flatten
      quality = quality_for(countable_period_entries)
      review_flags_by_entry = quality.delete(:review_flags_by_entry)
      days = build_days(countable_period_entries, items_by_entry, review_flags_by_entry)
      categories = build_categories(countable_period_entries, items_by_entry)
      clients = build_clients(items)
      services = build_services(items)
      work_breakdown = build_work_breakdown(items)
      weeks = build_weeks(user_context_entries, items)
      # Readiness is a control concern, not a display filter. Pending entries
      # and open clocks keep the report in draft even when hidden by a visible
      # approved-only filter. Denied entries remain visible as exclusions but
      # do not permanently block a completed report.
      issues = issues_for(control_period_entries)

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
        days_worked: days.size,
        first_work_date: days.first&.fetch(:work_date),
        last_work_date: days.last&.fetch(:work_date),
        ready: report_ready?(issues),
        issues: issues,
        quality: quality,
        excluded_entries: control_period_entries.reject { |entry| countable?(entry) }.map { |entry| serialize_entry(entry, unallocated_items(entry), []) },
        days: days,
        categories: categories,
        clients: clients,
        services: services,
        work_breakdown: work_breakdown,
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

    # Work lines reported for an entry: every line, or only the lines that
    # match the client/category/task/period filters.
    def included_lines(entry)
      @included_lines ||= {}
      @included_lines[entry.id] ||= all_lines(entry).select { |line| line_matches_filters?(line) }
    end

    def all_lines(entry)
      lines = entry.work_lines.to_a
      lines.empty? ? [ VirtualLine.new(entry: entry) ] : lines
    end

    def line_matches_filters?(line)
      return false if params[:client_id].present? && line.client_id.to_s != params[:client_id].to_s
      return false if params[:service_type_id].present? && line.service_type_id.to_s != params[:service_type_id].to_s
      return false if params[:service_task_id].present? && line.service_task_id.to_s != params[:service_task_id].to_s
      return false if period_type_filter && line.period_type.to_s != period_type_filter
      return false if period_start_filter && line.period_start != period_start_filter

      true
    end

    # Splits an entry's regular and overtime hours across its lines in line
    # order (regular hours first), so line parts add up to the entry exactly.
    def items_for(entry, allocations)
      allocation = allocations.fetch(entry.id, {})
      regular_left = BigDecimal(allocation[:regular_hours].to_f.to_s)
      included = included_lines(entry)

      all_lines(entry).filter_map do |line|
        hours = BigDecimal(line.hours.to_s).round(2)
        regular = [ hours, regular_left ].min
        regular_left -= regular
        next unless included.include?(line)

        Item.new(entry: entry, line: line, hours: hours.to_f, regular_hours: regular.to_f, overtime_hours: (hours - regular).to_f)
      end
    end

    def unallocated_items(entry)
      included_lines(entry).map do |line|
        Item.new(entry: entry, line: line, hours: line.hours.to_f, regular_hours: 0.0, overtime_hours: 0.0)
      end
    end

    def build_days(entries, items_by_entry, review_flags_by_entry)
      entries.group_by(&:work_date).sort_by { |date, _| date }.map do |date, day_entries|
        day_items = day_entries.flat_map { |entry| items_by_entry.fetch(entry.id, []) }
        {
          work_date: date.iso8601,
          total_hours: round_hours(day_items.sum(&:hours)),
          regular_hours: round_hours(day_items.sum(&:regular_hours)),
          overtime_hours: round_hours(day_items.sum(&:overtime_hours)),
          break_hours: round_hours(day_entries.sum { |entry| entry.break_minutes.to_i / 60.0 }),
          entries: day_entries.map { |entry| serialize_entry(entry, items_by_entry.fetch(entry.id, []), review_flags_by_entry.fetch(entry.id, [])) }
        }
      end
    end

    # Legacy flat time categories live on the entry.
    def build_categories(entries, items_by_entry)
      entries.group_by(&:time_category).map do |category, group_entries|
        group_items = group_entries.flat_map { |entry| items_by_entry.fetch(entry.id, []) }
        {
          id: category&.id,
          name: category&.name || "Uncategorized",
          total_hours: round_hours(group_items.sum(&:hours)),
          regular_hours: round_hours(group_items.sum(&:regular_hours)),
          overtime_hours: round_hours(group_items.sum(&:overtime_hours)),
          break_hours: round_hours(group_entries.sum { |entry| entry.break_minutes.to_i / 60.0 }),
          entries_count: group_entries.size
        }
      end.sort_by { |row| [ row[:name].to_s, row[:id].to_i ] }
    end

    def build_clients(items)
      grouped_summary(items.group_by { |item| item.line.client }) do |client|
        {
          id: client&.id,
          name: client ? client.display_name : UNASSIGNED_LABEL
        }
      end
    end

    # Hours grouped by client -> category -> task -> period, the order staff
    # log work in. Legacy entries group under their old category name.
    def build_work_breakdown(items)
      grouped = items.group_by do |item|
        line = item.line
        [ line.client_id, line.service_type_id, line.service_type_id ? nil : item.entry.time_category_id, line.service_task_id, line.period_type, line.period_start ]
      end

      grouped.map do |_key, group_items|
        sample = group_items.first
        line = sample.line
        {
          client_id: line.client_id,
          client_name: line.client ? line.client.display_name : UNASSIGNED_LABEL,
          service_type_id: line.service_type_id,
          time_category_id: line.service_type_id ? nil : sample.entry.time_category_id,
          category_name: line.category_label || "Uncategorized",
          legacy_category: line.service_type.nil? && sample.entry.time_category.present?,
          service_task_id: line.service_task_id,
          task_name: line.service_task&.name || "No task",
          period_type: line.period_type,
          period_start: line.period_start&.iso8601,
          period_label: line.period_label || "No period",
          total_hours: round_hours(group_items.sum(&:hours)),
          regular_hours: round_hours(group_items.sum(&:regular_hours)),
          overtime_hours: round_hours(group_items.sum(&:overtime_hours)),
          entries_count: group_items.map { |item| item.entry.id }.uniq.size
        }
      end.sort_by do |row|
        [ row[:client_id] ? 0 : 1, row[:client_name].downcase, row[:category_name].downcase, row[:task_name].downcase, row[:period_start].to_s ]
      end
    end

    def build_services(items)
      grouped_summary(items.group_by { |item| item.line.service_type }) do |service|
        {
          id: service&.id,
          name: service&.name || "No service"
        }
      end
    end

    # Break time belongs to the entry; it is counted once, in the group of
    # the entry's first reported line (lowest position), whatever order the
    # groups come in.
    def grouped_summary(grouped_items)
      first_item_ids = grouped_items.values.flatten.group_by { |item| item.entry.id }.transform_values do |entry_items|
        entry_items.min_by { |item| item.line.position.to_i }.object_id
      end

      grouped_items.map do |group, group_items|
        break_minutes = group_items.select { |item| first_item_ids[item.entry.id] == item.object_id }.sum { |item| item.entry.break_minutes.to_i }
        yield(group).merge(
          total_hours: round_hours(group_items.sum(&:hours)),
          regular_hours: round_hours(group_items.sum(&:regular_hours)),
          overtime_hours: round_hours(group_items.sum(&:overtime_hours)),
          break_hours: round_hours(break_minutes / 60.0),
          entries_count: group_items.map { |item| item.entry.id }.uniq.size
        )
      end.sort_by { |row| [ row[:name].to_s, row[:id].to_i ] }
    end

    def build_weeks(context_entries, period_items)
      items_by_week = period_items.group_by { |item| item.entry.work_date.beginning_of_week(:sunday) }

      context_entries.group_by { |entry| entry.work_date.beginning_of_week(:sunday) }.sort_by { |date, _| date }.map do |week_start, week_entries|
        week_end = week_start.end_of_week(:sunday)
        week_items = items_by_week.fetch(week_start, [])
        next if week_items.empty?

        weekly_total = round_hours(week_entries.select { |entry| countable?(entry) }.sum { |entry| entry.hours.to_f })
        period_hours = round_hours(week_items.sum(&:hours))
        context_hours = round_hours(weekly_total - period_hours)
        {
          week_start: week_start.iso8601,
          week_end: week_end.iso8601,
          weekly_total_hours: weekly_total,
          period_hours: period_hours,
          context_hours: context_hours,
          regular_hours: round_hours(week_items.sum(&:regular_hours)),
          overtime_hours: round_hours(week_items.sum(&:overtime_hours)),
          context_note: context_hours.positive? ? "Includes #{context_hours}h from outside this filtered report selection to calculate Sunday–Saturday overtime." : nil
        }
      end.compact
    end

    def serialize_line_item(item)
      line = item.line
      {
        id: line.id,
        position: line.position,
        client: line.client ? { id: line.client.id, name: line.client.display_name } : nil,
        client_label: line.client_label,
        description: line.description,
        service_type: line.service_type ? { id: line.service_type.id, name: line.service_type.name, color: line.service_type.color } : nil,
        service_task: line.service_task ? { id: line.service_task.id, name: line.service_task.name } : nil,
        category_label: line.category_label,
        period_type: line.period_type,
        period_start: line.period_start&.iso8601,
        period_label: line.period_label,
        total_hours: round_hours(item.hours),
        regular_hours: round_hours(item.regular_hours),
        overtime_hours: round_hours(item.overtime_hours),
        minutes: line.minutes
      }
    end

    def serialize_entry(entry, items, review_flags = [])
      {
        id: entry.id,
        work_date: entry.work_date.iso8601,
        start_time: entry.start_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
        end_time: entry.end_time&.in_time_zone(BUSINESS_TIMEZONE)&.strftime("%H:%M"),
        formatted_start_time: entry.formatted_start_time,
        formatted_end_time: entry.formatted_end_time,
        total_hours: round_hours(items.sum(&:hours)),
        regular_hours: round_hours(items.sum(&:regular_hours)),
        overtime_hours: round_hours(items.sum(&:overtime_hours)),
        entry_total_hours: round_hours(entry.hours.to_f),
        break_minutes: entry.break_minutes.to_i,
        description: entry.description,
        entry_method: entry.entry_method,
        approval_status: entry.approval_status,
        approved_by: entry.approved_by ? {
          id: entry.approved_by.id,
          full_name: entry.approved_by.full_name
        } : nil,
        approved_at: entry.approved_at&.iso8601,
        overtime_status: entry.overtime_status,
        overtime_approved_by: entry.overtime_approved_by ? {
          id: entry.overtime_approved_by.id,
          full_name: entry.overtime_approved_by.full_name
        } : nil,
        overtime_approved_at: entry.overtime_approved_at&.iso8601,
        locked_at: entry.locked_at&.iso8601,
        review_flags: review_flags,
        time_category: entry.time_category ? {
          id: entry.time_category.id,
          name: entry.time_category.name
        } : nil,
        client: entry.client ? {
          id: entry.client.id,
          name: entry.client.display_name
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
        category_label: entry.category_label,
        period_type: entry.period_type,
        period_start: entry.period_start&.iso8601,
        period_label: entry.period_label,
        work_lines: items.map { |item| serialize_line_item(item) },
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

    def quality_for(entries)
      cutover = TimeEntryWorkRequirement.cutover_date
      flags_by_entry = entries.to_h do |entry|
        flags = []
        lines = included_lines(entry)
        flags << "uncategorized" if entry.time_category_id.blank? && lines.any? { |line| line.service_type_id.blank? }
        flags << "missing_client" if lines.any? { |line| line.client_id.blank? }
        # The cutover rule's category: a line dated from the cutover without
        # one breaks it. "uncategorized" covers older lines too.
        if cutover && entry.work_date >= cutover && lines.any? { |line| line.service_type_id.blank? }
          flags << "missing_category"
        end
        flags << "long_shift" if entry.hours.to_f >= LONG_SHIFT_HOURS
        [ entry.id, flags ]
      end

      overlapping_entry_ids(entries).each do |entry_id|
        flags_by_entry.fetch(entry_id, []) << "overlap"
      end

      counts = %w[uncategorized missing_client missing_category long_shift overlap].index_with do |flag|
        flags_by_entry.count { |_entry, flags| flags.include?(flag) }
      end

      {
        status: counts.values.any?(&:positive?) ? "needs_review" : "clear",
        flagged_entries_count: flags_by_entry.count { |_entry, flags| flags.any? },
        uncategorized_count: counts.fetch("uncategorized"),
        missing_client_count: counts.fetch("missing_client"),
        missing_category_count: counts.fetch("missing_category"),
        long_shift_count: counts.fetch("long_shift"),
        overlapping_entry_count: counts.fetch("overlap"),
        long_shift_threshold_hours: LONG_SHIFT_HOURS,
        review_flags_by_entry: flags_by_entry
      }
    end

    def overlapping_entry_ids(entries)
      intervals = entries.filter_map do |entry|
        next unless entry.start_time.present? && entry.end_time.present?

        day_offset = entry.work_date.jd * 24.hours.to_i
        start_seconds = day_offset + entry.start_time.in_time_zone(BUSINESS_TIMEZONE).seconds_since_midnight
        end_seconds = day_offset + entry.end_time.in_time_zone(BUSINESS_TIMEZONE).seconds_since_midnight
        end_seconds += 24.hours.to_i if end_seconds <= start_seconds
        [ entry.id, start_seconds, end_seconds ]
      end.sort_by { |_id, start_seconds, end_seconds| [ start_seconds, end_seconds ] }

      intervals.each_with_index.each_with_object(Set.new) do |((entry_id, start_seconds, end_seconds), index), flagged|
        intervals.drop(index + 1).each do |(other_id, other_start, other_end)|
          break if other_start >= end_seconds
          next unless start_seconds < other_end && other_start < end_seconds

          flagged << entry_id
          flagged << other_id
        end
      end.to_a
    end

    def aggregate_quality(employees)
      count_keys = %i[
        flagged_entries_count
        uncategorized_count
        missing_client_count
        missing_category_count
        long_shift_count
        overlapping_entry_count
      ]
      counts = count_keys.index_with do |key|
        employees.sum { |employee| employee.dig(:quality, key).to_i }
      end

      counts.merge(
        status: counts[:flagged_entries_count].positive? ? "needs_review" : "clear",
        long_shift_threshold_hours: LONG_SHIFT_HOURS
      )
    end

    def report_ready?(issues)
      issues.values_at(:pending_count, :pending_overtime_count, :open_clock_count).all?(&:zero?)
    end

    def finalization_coverage
      locks = TimePeriodLock
        .where("start_date <= ? AND end_date >= ?", end_date, start_date)
        .includes(:locked_by)
        .order(:start_date, :id)
        .to_a
      selected_days = (end_date - start_date).to_i + 1
      finalized_days = finalized_days_count(locks)
      status = if finalized_days.zero?
        "not_finalized"
      elsif finalized_days == selected_days
        "finalized"
      else
        "partially_finalized"
      end
      label = case status
      when "finalized" then "Finalized for all #{selected_days} selected days"
      when "partially_finalized" then "Partially finalized (#{finalized_days} of #{selected_days} selected days)"
      else "Not finalized"
      end

      {
        status: status,
        label: label,
        selected_days: selected_days,
        finalized_days: finalized_days,
        locks: locks.map do |lock|
          {
            id: lock.id,
            start_date: lock.start_date.iso8601,
            end_date: lock.end_date.iso8601,
            locked_at: lock.locked_at.iso8601,
            reason: lock.reason,
            locked_by: lock.locked_by && { id: lock.locked_by.id, full_name: lock.locked_by.full_name }
          }
        end
      }
    end

    def finalized_days_count(locks)
      ranges = locks.map do |lock|
        [ [ lock.start_date, start_date ].max, [ lock.end_date, end_date ].min ]
      end.sort_by(&:first)

      merged_ranges = ranges.each_with_object([]) do |(range_start, range_end), merged|
        if merged.empty? || range_start > merged.last.last + 1.day
          merged << [ range_start, range_end ]
        else
          merged.last[1] = [ merged.last.last, range_end ].max
        end
      end

      merged_ranges.sum { |range_start, range_end| (range_end - range_start).to_i + 1 }
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
      params.to_h.slice(:user_id, :role, :status, :time_category_id, :client_id, :service_type_id, :service_task_id, :period_type, :period_start, :entry_method, :approval_status, :overtime_status, :include_empty)
    end

    def countable?(entry)
      entry.status == "completed" && !entry.approval_status.in?(%w[denied pending])
    end

    def user_status(user)
      return "terminated" if user.terminated?
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
