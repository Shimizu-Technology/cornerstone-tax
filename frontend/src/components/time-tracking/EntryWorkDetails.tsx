import type { HoursReportEntry, TimeEntry, WorkLine } from '../../lib/api'
import { NO_CLIENT_LABEL, entryComments, entryLines, lineCategoryName, lineClientName, periodLabel, workCategory, workCategoryText, workLineSummary, workLineText, workSummary } from '../../lib/timeEntryWork'
import { formatMinutes } from '../../lib/workDuration'

// The chip styles the Time Entries card has always used.
const categoryChip = 'px-2 py-0.5 bg-primary/10 text-primary font-medium rounded'
const uncategorizedChip = 'px-2 py-0.5 bg-neutral-warm/50 text-text-muted rounded'
const taskChip = 'px-2 py-0.5 bg-secondary/60 text-primary-dark rounded'
const periodChip = 'px-2 py-0.5 border border-neutral-warm text-primary-dark rounded'
const legacyMark = <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Legacy</span>

/** No client: a muted warning, never "Internal" (Internal – Cornerstone is a real client). */
function NoClient() {
  return <span className="font-semibold text-amber-700">{NO_CLIENT_LABEL}</span>
}

const isActive = (entry: Pick<TimeEntry, 'status'>) => entry.status === 'clocked_in' || entry.status === 'on_break'

/** A line's category for a chip: the name, and whether it's a legacy category. */
function lineCategory(line: Pick<WorkLine, 'service_type' | 'category_label'>): { label: string; legacy: boolean } | null {
  const name = lineCategoryName(line)
  if (!name) return null
  // The server marks a legacy category in category_label ("Tax Prep (legacy)").
  const legacy = !line.service_type
  return { label: legacy ? name.replace(/ \(legacy\)$/, '') : name, legacy }
}

const linePeriod = (line: Pick<WorkLine, 'period_label' | 'period_type' | 'period_start'>) =>
  line.period_label || periodLabel(line.period_type, line.period_start)

/**
 * The work on a Time Entries card, in the owner's order: Client · Category ·
 * Task · Period. Shown from the entry's work lines whenever it has any (the
 * entry-level fields only mirror line 1): several lines get one row each
 * with their time and comments; a single line looks as a card always has.
 * An entry without lines (legacy) uses its own fields. A running clock with
 * no client yet says "No client yet" rather than suggesting one.
 */
export default function EntryWorkDetails({ entry }: { entry: TimeEntry }) {
  const lines = entryLines(entry)
  if (lines.length > 1) {
    return (
      <ul className="mt-2 space-y-1.5" aria-label="Work lines">
        {lines.map((line) => <WorkLineRow key={line.id ?? line.position} line={line} />)}
      </ul>
    )
  }

  const active = isActive(entry)
  const line = lines[0]
  // One line, or the entry's own fields when it has none.
  const work = line
    ? { client: line.client ? lineClientName(line) : null, category: lineCategory(line), task: line.service_task?.name, period: linePeriod(line) }
    : { client: entry.client?.name ?? null, category: workCategory(entry), task: entry.service_task?.name, period: entry.period_label || periodLabel(entry.period_type, entry.period_start) }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm" data-testid="entry-work">
      {work.client ? (
        <span className="font-semibold text-primary-dark">
          {work.client}
          {entry.tax_return && ` (${entry.tax_return.tax_year})`}
        </span>
      ) : active ? (
        <span className="font-medium text-text-muted">No client yet</span>
      ) : (
        <NoClient />
      )}
      {work.category ? (
        <span className={categoryChip}>{work.category.label}{work.category.legacy && legacyMark}</span>
      ) : !active && (
        <span className={uncategorizedChip}>Uncategorized</span>
      )}
      {work.task && <span className={taskChip}>{work.task}</span>}
      {work.period && <span className={periodChip}>{work.period}</span>}
    </div>
  )
}

function WorkLineRow({ line }: { line: WorkLine }) {
  const category = lineCategory(line)
  const period = linePeriod(line)
  return (
    <li className="text-xs sm:text-sm" title={workLineSummary(line)}>
      {/* The line's time sits at the end of its first row, so it never wraps alone. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {line.client ? <span className="font-semibold text-primary-dark">{lineClientName(line)}</span> : <NoClient />}
          {/* A missing category shows nothing on a split line, as in Approvals. */}
          {category && <span className={categoryChip}>{category.label}{category.legacy && legacyMark}</span>}
          {line.service_task && <span className={taskChip}>{line.service_task.name}</span>}
          {period && <span className={periodChip}>{period}</span>}
        </div>
        <span className="shrink-0 py-0.5 font-medium tabular-nums text-primary-dark">{formatMinutes(line.minutes)}</span>
      </div>
      {line.description && <p className="mt-0.5 text-sm text-primary-dark">{line.description}</p>}
    </li>
  )
}

/**
 * The work in a desktop Week view cell, which is about 9rem wide. A split
 * entry lists each line's client and time on its own row (up to three; the
 * rest as "+N more"), with every line in full in the cell's tooltip. Category
 * and period are left out there: the client and time are what a seven-column
 * week can show readably, and the Day view and the editor have the rest.
 * A single line, or an entry without lines, shows client, category / task
 * and period as before.
 */
export function EntryWorkCompact({ entry }: { entry: TimeEntry }) {
  const lines = entryLines(entry)
  if (lines.length > 1) {
    const shown = lines.slice(0, 3)
    return (
      <ul
        className="mt-0.5 space-y-0.5 text-[10px] sm:text-xs"
        aria-label="Work lines"
        title={lines.map((line) => `${workLineText(line)} · ${formatMinutes(line.minutes)}`).join('\n')}
      >
        {shown.map((line) => (
          <li key={line.id ?? line.position} className="flex min-w-0 items-baseline justify-between gap-1">
            <span className={`truncate font-medium ${line.client ? 'text-primary-dark' : 'text-amber-700'}`}>{lineClientName(line)}</span>
            <span className="shrink-0 tabular-nums text-primary-dark/70">{formatMinutes(line.minutes)}</span>
          </li>
        ))}
        {lines.length > shown.length && <li className="text-text-muted">+{lines.length - shown.length} more</li>}
      </ul>
    )
  }

  const line = lines[0]
  const active = isActive(entry)
  const client = line ? (line.client ? lineClientName(line) : null) : entry.client?.name ?? null
  const category = line ? lineCategory(line)?.label ?? null : workCategory(entry) ? workCategoryText(entry) : null
  const legacy = line ? Boolean(lineCategory(line)?.legacy) : Boolean(workCategory(entry)?.legacy)
  const task = line ? line.service_task?.name : entry.service_task?.name
  const period = line ? linePeriod(line) : entry.period_label || periodLabel(entry.period_type, entry.period_start)
  const categoryText = category && (legacy && line ? `${category} (legacy)` : category)
  return (
    <>
      {client ? (
        <div className="text-primary-dark font-medium truncate text-[10px] sm:text-xs" title={client}>{client}</div>
      ) : active ? (
        <div className="text-text-muted truncate text-[10px] sm:text-xs">No client yet</div>
      ) : (
        <div className="text-amber-700 font-medium truncate text-[10px] sm:text-xs">{NO_CLIENT_LABEL}</div>
      )}
      {categoryText && (
        <div className="text-primary font-medium truncate text-[10px] sm:text-xs" title={[categoryText, task].filter(Boolean).join(' / ')}>
          {categoryText}{task ? ` / ${task}` : ''}
        </div>
      )}
      {period && <div className="text-primary-dark/70 truncate text-[10px]">{period}</div>}
    </>
  )
}

/**
 * An entry's work in the hours report (daily detail and the employee drawer).
 * From the lines whenever there are any: a client-filtered report returns
 * only the matching lines, while the entry-level fields mirror line 1.
 */
export function ReportEntryWork({ entry, size = 'sm', showComments = false }: { entry: TimeEntry | HoursReportEntry; size?: 'sm' | 'xs'; showComments?: boolean }) {
  const lines = entryLines<WorkLineLikeWithMinutes>(entry)
  const meta = size === 'sm' ? 'mt-1 text-sm text-text-muted' : 'mt-1 text-xs text-text-muted'
  if (lines.length > 1) {
    return (
      <>
        <p className={meta}>{entry.entry_method}</p>
        <ul className={`mt-1 space-y-0.5 text-primary-dark ${size === 'sm' ? 'text-sm' : 'text-xs'}`} aria-label="Work lines">
          {lines.map((line) => <li key={line.id ?? line.position}>{workLineText(line)} · <span className="tabular-nums">{formatMinutes(line.minutes)}</span></li>)}
        </ul>
      </>
    )
  }
  const summary = lines.length ? workLineSummary(lines[0], { uncategorized: 'Uncategorized' }) : workSummary(entry)
  return (
    <>
      <p className={meta}>{summary} · {entry.entry_method}</p>
      {showComments && <p className="mt-1 text-sm text-primary-dark">{entryComments(entry) || 'No comments'}</p>}
    </>
  )
}

type WorkLineLikeWithMinutes = Parameters<typeof workLineText>[0] & { id: number | null; position: number; minutes: number }
