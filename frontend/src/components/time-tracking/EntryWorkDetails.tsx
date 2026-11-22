import type { TimeEntry, WorkLine } from '../../lib/api'
import { NO_CLIENT_LABEL, isSplitEntry, periodLabel, workCategory, workLineSummary } from '../../lib/timeEntryWork'
import { formatMinutes } from '../../lib/workDuration'

// The chip styles the Time Entries card has always used.
const categoryChip = 'px-2 py-0.5 bg-primary/10 text-primary font-medium rounded'
const uncategorizedChip = 'px-2 py-0.5 bg-neutral-warm/50 text-text-muted rounded'
const taskChip = 'px-2 py-0.5 bg-secondary/60 text-primary-dark rounded'
const periodChip = 'px-2 py-0.5 border border-neutral-warm text-primary-dark rounded'
const legacyMark = <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Legacy</span>

/** No client: a muted warning, never "Internal" (Internal – Cornerstone is a real client). */
function NoClient({ label = NO_CLIENT_LABEL }: { label?: string }) {
  return <span className="font-semibold text-amber-700">{label}</span>
}

/**
 * The work on a Time Entries card, in the owner's order: Client · Category ·
 * Task · Period. An entry split across several work lines shows one row per
 * line, with its time and comments (the entry's own work fields are empty
 * then). A single-line entry looks as it always has. A clock still running
 * with no client yet says "No client yet" rather than suggesting one.
 */
export default function EntryWorkDetails({ entry }: { entry: TimeEntry }) {
  if (isSplitEntry(entry)) {
    return (
      <ul className="mt-2 space-y-1.5" aria-label="Work lines">
        {entry.work_lines!.map((line) => <WorkLineRow key={line.id ?? line.position} line={line} />)}
      </ul>
    )
  }

  const active = entry.status === 'clocked_in' || entry.status === 'on_break'
  const category = workCategory(entry)
  const period = entry.period_label || periodLabel(entry.period_type, entry.period_start)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm" data-testid="entry-work">
      {entry.client ? (
        <span className="font-semibold text-primary-dark">
          {entry.client.name}
          {entry.tax_return && ` (${entry.tax_return.tax_year})`}
        </span>
      ) : active ? (
        <span className="font-medium text-text-muted">No client yet</span>
      ) : (
        <NoClient />
      )}
      {category ? (
        <span className={categoryChip}>{category.label}{category.legacy && legacyMark}</span>
      ) : !active && (
        <span className={uncategorizedChip}>Uncategorized</span>
      )}
      {entry.service_task && <span className={taskChip}>{entry.service_task.name}</span>}
      {period && <span className={periodChip}>{period}</span>}
    </div>
  )
}

function WorkLineRow({ line }: { line: WorkLine }) {
  // The server marks a legacy category in category_label ("Tax Prep (legacy)").
  const legacy = !line.service_type && Boolean(line.category_label)
  const categoryName = line.service_type?.name || line.category_label?.replace(/ \(legacy\)$/, '')
  return (
    <li className="text-xs sm:text-sm" title={workLineSummary(line)}>
      {/* The line's time sits at the end of its first row, so it never wraps alone. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {line.client ? <span className="font-semibold text-primary-dark">{line.client_label}</span> : <NoClient />}
          {categoryName ? (
            <span className={categoryChip}>{categoryName}{legacy && legacyMark}</span>
          ) : (
            <span className={uncategorizedChip}>Uncategorized</span>
          )}
          {line.service_task && <span className={taskChip}>{line.service_task.name}</span>}
          {line.period_label && <span className={periodChip}>{line.period_label}</span>}
        </div>
        <span className="shrink-0 py-0.5 font-medium tabular-nums text-primary-dark">{formatMinutes(line.minutes)}</span>
      </div>
      {line.description && <p className="mt-0.5 text-sm text-primary-dark">{line.description}</p>}
    </li>
  )
}
