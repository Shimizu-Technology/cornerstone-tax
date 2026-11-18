import type { HoursReportParams } from './api'
import type { HoursReportFilters } from '../components/time-tracking/HoursReportWorkspace'
import { isPeriodType, periodStartContaining } from './timeEntryWork'

/**
 * Make report filters match what the filter controls can show, so a shared
 * URL never applies a criterion the user cannot see:
 * - a current category wins over a legacy category (the picker shows one);
 * - a task needs its category;
 * - a period needs a type and an aligned start, otherwise both are dropped.
 */
export function normalizeReportFilters(filters: HoursReportFilters): HoursReportFilters {
  const next = { ...filters }
  if (next.service_type_id && next.time_category_id) next.time_category_id = ''
  if (next.service_task_id && !next.service_type_id) next.service_task_id = ''

  const validPeriod = isPeriodType(next.period_type) &&
    /^\d{4}-\d{2}-\d{2}$/.test(next.period_start) &&
    periodStartContaining(next.period_type, next.period_start) === next.period_start
  if (!validPeriod) {
    next.period_type = ''
    next.period_start = ''
  }
  return next
}

const toInt = (value: string) => parseInt(value, 10)

/** One builder for the report preview and every download. */
export function buildHoursReportParams(rawFilters: HoursReportFilters): HoursReportParams {
  const filters = normalizeReportFilters(rawFilters)
  return {
    start_date: filters.start_date,
    end_date: filters.end_date,
    approval_status: 'approved_or_standard',
    ...(filters.user_id ? { user_id: toInt(filters.user_id) } : {}),
    ...(filters.time_category_id ? { time_category_id: toInt(filters.time_category_id) } : {}),
    ...(filters.client_id ? { client_id: toInt(filters.client_id) } : {}),
    ...(filters.service_type_id ? { service_type_id: toInt(filters.service_type_id) } : {}),
    ...(filters.service_task_id ? { service_task_id: toInt(filters.service_task_id) } : {}),
    ...(isPeriodType(filters.period_type) && filters.period_start ? { period_type: filters.period_type, period_start: filters.period_start } : {}),
    ...(filters.status ? { status: filters.status as HoursReportParams['status'] } : {}),
    ...(filters.entry_method ? { entry_method: filters.entry_method as HoursReportParams['entry_method'] } : {}),
    ...(filters.overtime_status ? { overtime_status: filters.overtime_status as HoursReportParams['overtime_status'] } : {}),
  }
}
