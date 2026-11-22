// Shared helpers for the work details on a time entry:
// Client -> Category -> Task -> Period -> Comments.
//
// The backend owns the client label rule (Client#display_name: business name
// for businesses, otherwise "First Last") and sends it as `name`. These
// helpers only read that label, search and sort by it, and describe the
// optional accounting period.

export type PeriodType = 'month' | 'quarter' | 'year'

export const PERIOD_TYPES: Array<{ value: PeriodType; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const QUARTER_ORDINALS = ['1st', '2nd', '3rd', '4th']

/** "3rd Quarter" for quarter 3. */
export function quarterName(quarter: number): string {
  return `${QUARTER_ORDINALS[quarter - 1]} Quarter`
}

export interface WorkPeriod {
  period_type: PeriodType | ''
  // First day of the month, quarter or year, as YYYY-MM-DD.
  period_start: string
}

export function isPeriodType(value: unknown): value is PeriodType {
  return value === 'month' || value === 'quarter' || value === 'year'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function parseIsoDate(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** First day of the period that contains the given ISO date. */
export function periodStartContaining(type: PeriodType, isoDate: string): string {
  const parsed = parseIsoDate(isoDate) ?? parseIsoDate(new Date().toISOString().slice(0, 10))!
  if (type === 'year') return `${parsed.year}-01-01`
  if (type === 'quarter') return `${parsed.year}-${pad(Math.floor((parsed.month - 1) / 3) * 3 + 1)}-01`
  return `${parsed.year}-${pad(parsed.month)}-01`
}

/** Build a period start from its parts. `part` is the month (1-12) or quarter (1-4). */
export function periodStartFor(type: PeriodType, year: number, part = 1): string {
  if (type === 'year') return `${year}-01-01`
  if (type === 'quarter') return `${year}-${pad((part - 1) * 3 + 1)}-01`
  return `${year}-${pad(part)}-01`
}

/** Split a period start into the year and the month or quarter number. */
export function periodParts(type: PeriodType, start: string): { year: number; part: number } | null {
  const parsed = parseIsoDate(start)
  if (!parsed) return null
  if (type === 'quarter') return { year: parsed.year, part: Math.floor((parsed.month - 1) / 3) + 1 }
  if (type === 'month') return { year: parsed.year, part: parsed.month }
  return { year: parsed.year, part: 1 }
}

/** "July 2026", "3rd Quarter 2026", "2026", or null when no period is set. */
export function periodLabel(type: string | null | undefined, start: string | null | undefined): string | null {
  if (!isPeriodType(type) || !start) return null
  const parts = periodParts(type, start)
  if (!parts) return null
  if (type === 'month') return `${MONTH_NAMES[parts.part - 1]} ${parts.year}`
  if (type === 'quarter') return `${quarterName(parts.part)} ${parts.year}`
  return String(parts.year)
}

interface CategorizedEntry {
  service_type?: { id: number; name: string } | null
  time_category?: { id: number; name: string } | null
}

export interface WorkCategory {
  label: string
  legacy: boolean
}

/**
 * The category staff picked. New entries use the Category -> Task lists;
 * older entries may only carry a legacy time category, shown as legacy.
 */
export function workCategory(entry: CategorizedEntry): WorkCategory | null {
  if (entry.service_type) return { label: entry.service_type.name, legacy: false }
  if (entry.time_category) return { label: entry.time_category.name, legacy: true }
  return null
}

export function workCategoryText(entry: CategorizedEntry, fallback = 'Uncategorized'): string {
  const category = workCategory(entry)
  if (!category) return fallback
  return category.legacy ? `${category.label} (legacy)` : category.label
}

interface WorkSummaryEntry extends CategorizedEntry {
  client?: { name: string } | null
  service_task?: { name: string } | null
  period_label?: string | null
  period_type?: string | null
  period_start?: string | null
}

/**
 * "MoSa's · Bookkeeping · Bank Reconciliation · July 2026". `uncategorized`
 * is shown when there is no category; null leaves it out.
 */
export function workSummary(
  entry: WorkSummaryEntry,
  { includeClient = true, uncategorized = 'Uncategorized' as string | null } = {},
): string {
  const parts = [
    includeClient ? entry.client?.name || 'Internal' : null,
    workCategory(entry) ? workCategoryText(entry) : uncategorized,
    entry.service_task?.name,
    entry.period_label || periodLabel(entry.period_type, entry.period_start),
  ]
  return parts.filter(Boolean).join(' · ')
}

interface WorkLineLike {
  client_label: string
  service_type?: { id: number; name: string } | null
  service_task?: { name: string } | null
  category_label?: string | null
  period_label?: string | null
  description?: string | null
}

/**
 * A work line in the owner's order: "MoSa's · Bookkeeping · Bank
 * Reconciliation · July 2026" (a missing category is left out).
 */
export function workLineSummary(line: WorkLineLike): string {
  // The server's category_label already marks a legacy category.
  const label = line.category_label || line.service_type?.name
  return workSummary({
    client: { name: line.client_label },
    service_type: label ? { id: line.service_type?.id ?? 0, name: label } : null,
    service_task: line.service_task,
    period_label: line.period_label,
  }, { uncategorized: null })
}

/** The line summary, then its comments if any: "MoSa's · Bookkeeping — Filed late". */
export function workLineText(line: WorkLineLike): string {
  const comments = line.description?.trim()
  return comments ? `${workLineSummary(line)} — ${comments}` : workLineSummary(line)
}

export interface ClientOption {
  id: number
  name?: string
  business_name?: string | null
  first_name?: string
  last_name?: string
  client_type?: string | null
  /** "internal" for the Internal – Cornerstone client; null for real clients. */
  system_kind?: string | null
}

/** The empty choice in client pickers: time not attributed to any client. */
export const INTERNAL_CLIENT_LABEL = 'No client (unassigned)'

export function isInternalClient(client: ClientOption | null | undefined): boolean {
  return client?.system_kind === 'internal'
}

function clientGroupRank(client: ClientOption): number {
  if (isInternalClient(client)) return 0
  return client.client_type === 'business' ? 1 : 2
}

/** Picker group label: internal, businesses, then individuals. */
export function clientGroupLabel(client: ClientOption): string {
  const rank = clientGroupRank(client)
  return rank === 0 ? 'Cornerstone' : rank === 1 ? 'Businesses' : 'Individuals'
}

interface CategoryOption { id: number; internal?: boolean | null }

/**
 * Internal work uses the internal categories (office & errands, meetings,
 * training, admin); client work uses the others. With no client chosen,
 * every category is offered.
 */
export function categoriesForClient<T extends CategoryOption>(categories: T[], client: ClientOption | null | undefined): T[] {
  if (!client) return categories
  const internal = isInternalClient(client)
  return categories.filter((category) => Boolean(category.internal) === internal)
}

export function clientOptionLabel(client: ClientOption): string {
  return client.name?.trim() || [client.first_name, client.last_name].filter(Boolean).join(' ') || `Client #${client.id}`
}

/** Internal client first, then businesses, then individuals, each by name. */
export function sortClientOptions<T extends ClientOption>(clients: T[]): T[] {
  return [...clients].sort((a, b) =>
    clientGroupRank(a) - clientGroupRank(b) ||
    clientOptionLabel(a).localeCompare(clientOptionLabel(b), undefined, { sensitivity: 'base' }) ||
    a.id - b.id)
}

/** Match on the label, business name, first name or last name. */
export function filterClientOptions<T extends ClientOption>(clients: T[], query: string): T[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return clients
  return clients.filter((client) => {
    const haystack = [clientOptionLabel(client), client.business_name, client.first_name, client.last_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

// Category filters cover both the current categories and legacy time
// categories, so filter values are prefixed: "st:<service type id>" or
// "tc:<legacy time category id>".
export type CategoryFilterValue = '' | `st:${number}` | `tc:${number}`

export function categoryFilterValue(serviceTypeId: string, timeCategoryId: string): CategoryFilterValue {
  if (serviceTypeId) return `st:${Number(serviceTypeId)}`
  if (timeCategoryId) return `tc:${Number(timeCategoryId)}`
  return ''
}

export function parseCategoryFilter(value: string): { service_type_id: string; time_category_id: string } {
  const match = value.match(/^(st|tc):(\d+)$/)
  if (!match) return { service_type_id: '', time_category_id: '' }
  return match[1] === 'st'
    ? { service_type_id: match[2], time_category_id: '' }
    : { service_type_id: '', time_category_id: match[2] }
}
