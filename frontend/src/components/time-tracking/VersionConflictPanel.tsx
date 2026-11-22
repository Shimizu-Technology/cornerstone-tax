import type { TimeEntry } from '../../lib/api'
import { workLineText } from '../../lib/timeEntryWork'
import { formatMinutes } from '../../lib/workDuration'

/**
 * Shown when a save is refused because the record changed (or a day log
 * appeared) elsewhere: the person decides what happens to their lines.
 */
export default function VersionConflictPanel({
  title,
  detail,
  busy = false,
  canSaveSeparately = true,
  onSaveSeparately,
  onDiscard,
  current,
}: {
  title: string
  detail: string
  busy?: boolean
  canSaveSeparately?: boolean
  onSaveSeparately: () => void
  onDiscard: () => void
  /** The entry as it is saved now (refetched on the conflict), if known. */
  current?: TimeEntry | null
}) {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
      <p className="font-semibold">{title}</p>
      <p>{detail} You can keep your lines as a separate day log, or discard them.</p>
      {current?.work_lines && current.work_lines.length > 0 && (
        <div>
          <p className="font-medium">Saved now:</p>
          <ul className="ml-4 list-disc" aria-label="Lines saved now">
            {current.work_lines.map((line) => (
              <li key={line.id ?? line.position}>
                {workLineText(line)} · {formatMinutes(line.minutes)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSaveSeparately} disabled={busy || !canSaveSeparately} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50">
          Save my lines as a separate day log
        </button>
        <button type="button" onClick={onDiscard} disabled={busy} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold text-red-800">
          Discard my lines
        </button>
      </div>
    </div>
  )
}
