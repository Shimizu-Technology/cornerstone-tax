import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ServiceType } from '../../lib/api'
import {
  INTERNAL_CLIENT_LABEL,
  categoriesForClient,
  clientGroupLabel,
  clientOptionLabel,
  filterClientOptions,
  isInternalClient,
  sortClientOptions,
  type ClientOption,
} from '../../lib/timeEntryWork'
import { formatMinutes, minutesToHoursText, type DurationUnit } from '../../lib/workDuration'
import { PeriodPicker } from './TimeEntryWorkFields'
import { checkLines, draftMinutes, duplicateDraft, newDraft, type WorkLineDraft, type WorkLineSuggestions } from './workLinesModel'

// 16px text on phones so iOS never zooms; 44px minimum tap targets.
const inputClass = 'min-h-11 w-full rounded-lg border border-neutral-warm bg-white px-3 py-2 text-base md:text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-neutral-warm/30'
const labelClass = 'mb-1 block text-sm font-medium text-primary-dark'
// Chips wrap instead of truncating, so a long client name stays readable in a narrow column.
const chipClass = 'min-h-11 max-w-full whitespace-normal break-words rounded-[1.375rem] border border-neutral-warm bg-white px-3 py-1.5 text-left text-sm leading-snug text-primary-dark hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary'
// The table layout is driven by the editor's own width (a container query),
// not the viewport: the same editor sits in a full-width card, a modal and a
// sheet, and a viewport breakpoint squeezed it into an overflowing grid in the
// narrower ones. Below this width each line stacks with visible labels.
// Minimums (51rem plus gaps and the line's padding) fit inside the 56rem threshold.
const gridColumns = '@4xl:grid-cols-[minmax(11.5rem,1.2fr)_minmax(13rem,2fr)_minmax(10rem,1.2fr)_10.5rem_6rem]'

export interface WorkLinesEditorProps {
  lines: WorkLineDraft[]
  onChange: (lines: WorkLineDraft[]) => void
  /**
   * Length of the clock session or timed entry in minutes. Lines must add up
   * to it. null for a day log, whose total is simply the sum of its lines.
   */
  targetMinutes: number | null
  clients: ClientOption[]
  serviceTypes: ServiceType[]
  suggestions?: WorkLineSuggestions
  /** Client and description required (the cutover applies). */
  required?: boolean
  /**
   * Settings > "Require a task on every work line" (applies with `required`).
   * Defaults to what the suggestions say.
   */
  taskRequired?: boolean
  referenceDate?: string
  idPrefix?: string
  /**
   * "session": one line covers the whole session until the user splits it
   * (clock-out, manual entry, edit, approvals). "day": the Log my day grid,
   * always explicit times, Enter on a time adds a row.
   */
  mode?: 'session' | 'day'
  disabled?: boolean
}

export default function WorkLinesEditor({
  lines,
  onChange,
  targetMinutes,
  clients,
  serviceTypes,
  suggestions,
  required = false,
  taskRequired: taskRequiredProp,
  referenceDate,
  idPrefix,
  mode = 'session',
  disabled = false,
}: WorkLinesEditorProps) {
  const generatedId = useId()
  const prefix = idPrefix || generatedId.replace(/:/g, '')
  // Line whose client field should get focus after the next render.
  const pendingFocus = useRef<string | null>(null)
  const taskRequired = required && (taskRequiredProp ?? suggestions?.taskRequired ?? false)
  const check = checkLines(lines, { targetMinutes, required, clients, serviceTypes, taskRequired, singleCoversTarget: mode === 'session' })
  const singleSession = mode === 'session' && lines.length === 1 && targetMinutes !== null

  // Move focus to the client field of a line that was just added.
  useEffect(() => {
    if (!pendingFocus.current) return
    document.getElementById(`${prefix}-${pendingFocus.current}-client`)?.focus()
    pendingFocus.current = null
  })

  const update = (key: string, patch: Partial<WorkLineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const addLine = (template?: WorkLineDraft) => {
    const added = template ? duplicateDraft(template) : newDraft({ unit: lines[lines.length - 1]?.unit ?? 'minutes' })
    let next = [...lines]
    // Splitting a whole-session line: it keeps the full time until reduced.
    if (singleSession) next = next.map((line) => ({ ...line, durationText: String(targetMinutes), unit: 'minutes' as DurationUnit }))
    if (check.remainingMinutes !== null && check.remainingMinutes > 0 && !singleSession) added.durationText = String(check.remainingMinutes)
    next.push({ ...added, unit: added.durationText ? 'minutes' : added.unit })
    onChange(next)
    pendingFocus.current = added.key
  }

  const removeLine = (key: string) => {
    const next = lines.filter((line) => line.key !== key)
    onChange(next.length ? next : [newDraft()])
  }

  const absorbRemaining = (line: WorkLineDraft) => {
    if (check.remainingMinutes === null) return
    const current = draftMinutes(line) ?? 0
    const next = current + check.remainingMinutes
    if (next > 0) update(line.key, { durationText: String(next), unit: 'minutes' })
  }

  return (
    <div className="@container space-y-3" data-testid="work-lines-editor">
      {mode === 'session' && targetMinutes !== null && (
        <p className="text-sm text-text-muted">
          Session length: <span className="font-semibold tabular-nums text-primary-dark">{formatMinutes(targetMinutes)}</span>
          <span className="tabular-nums"> ({minutesToHoursText(targetMinutes)}h)</span>
        </p>
      )}

      {/* Column titles for the desktop table; phones show per-field labels. */}
      {!singleSession && (
        // Same border and padding as a line, so each title sits over its column.
        <div aria-hidden="true" className={`hidden @4xl:grid ${gridColumns} @4xl:gap-x-2 border border-transparent px-2 text-xs font-semibold uppercase tracking-wide text-text-muted`}>
          <span>Client</span><span>What I did</span><span>Category</span><span>Time</span><span className="sr-only">Actions</span>
        </div>
      )}

      <ol className="space-y-3 @4xl:space-y-2" aria-label="Work lines">
        {lines.map((line, index) => (
          <WorkLineRow
            key={line.key}
            line={line}
            index={index}
            count={lines.length}
            prefix={prefix}
            clients={clients}
            serviceTypes={serviceTypes}
            suggestions={suggestions}
            required={required}
            taskRequired={taskRequired}
            referenceDate={referenceDate}
            wholeSession={singleSession}
            wholeSessionMinutes={targetMinutes}
            problems={check.problems[line.key] || []}
            remainingMinutes={check.remainingMinutes}
            disabled={disabled}
            onChange={(patch) => update(line.key, patch)}
            onRemove={() => removeLine(line.key)}
            onDuplicate={() => addLine(line)}
            onAbsorbRemaining={() => absorbRemaining(line)}
            onEnterOnTime={mode === 'day' && index === lines.length - 1 ? () => addLine() : undefined}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addLine()}
          disabled={disabled}
          className="min-h-11 rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
        >
          {singleSession ? 'Split across clients' : 'Add line'}
        </button>
        {!singleSession && lines.length > 0 && (
          <button
            type="button"
            onClick={() => addLine(lines[lines.length - 1])}
            disabled={disabled}
            className="min-h-11 rounded-lg border border-neutral-warm px-4 text-sm font-medium text-primary-dark hover:bg-secondary disabled:opacity-50"
          >
            Duplicate previous
          </button>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
          check.remainingMinutes === null || check.remainingMinutes === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
        }`}
        data-testid="work-lines-remaining"
      >
        <span>{check.summary}</span>
        <span className="tabular-nums">
          {check.remainingMinutes === null
            ? `${minutesToHoursText(check.totalMinutes)}h`
            : `Remaining ${minutesToHoursText(check.remainingMinutes)}h`}
        </span>
      </div>
    </div>
  )
}

function WorkLineRow({
  line,
  index,
  count,
  prefix,
  clients,
  serviceTypes,
  suggestions,
  required,
  taskRequired,
  referenceDate,
  wholeSession,
  wholeSessionMinutes,
  problems,
  remainingMinutes,
  disabled,
  onChange,
  onRemove,
  onDuplicate,
  onAbsorbRemaining,
  onEnterOnTime,
}: {
  line: WorkLineDraft
  index: number
  count: number
  prefix: string
  clients: ClientOption[]
  serviceTypes: ServiceType[]
  suggestions?: WorkLineSuggestions
  required: boolean
  /** A category, and a task when the category has tasks, are required. */
  taskRequired: boolean
  referenceDate?: string
  wholeSession: boolean
  wholeSessionMinutes: number | null
  problems: string[]
  remainingMinutes: number | null
  disabled: boolean
  onChange: (patch: Partial<WorkLineDraft>) => void
  onRemove: () => void
  onDuplicate: () => void
  onAbsorbRemaining: () => void
  onEnterOnTime?: () => void
}) {
  const id = `${prefix}-${line.key}`
  const lineName = count > 1 ? `Line ${index + 1}` : 'Work'
  const [showMore, setShowMore] = useState(Boolean(line.service_task_id || line.period_type))
  const client = clients.find((option) => String(option.id) === line.client_id) ?? null
  const categories = useMemo(
    () => [...categoriesForClient(serviceTypes, client)].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)),
    [serviceTypes, client],
  )
  const category = serviceTypes.find((type) => String(type.id) === line.service_type_id)
  const tasks = [...(category?.tasks || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
  const categoryNeeded = taskRequired || (required && isInternalClient(client))
  const taskNeeded = taskRequired && (!line.service_type_id || tasks.length > 0)
  const descriptionChips = (suggestions?.descriptionsByClient[line.client_id || ''] || []).slice(0, 4)
  const minutes = wholeSession ? wholeSessionMinutes : draftMinutes(line)
  const problemId = `${id}-problems`
  // The category and task pickers point at the line's message when it is
  // about them, and say they're invalid.
  const categoryInvalid = problems.some((problem) => problem.startsWith('Choose a category'))
  const taskInvalid = problems.some((problem) => problem === 'Choose a task' || problem === 'Choose a category and a task')
  // With "Require a task" on, the task sits next to the category; otherwise
  // it is tucked away with the period.
  const taskField = (
    <div>
      <label htmlFor={`${id}-task`} className={labelClass}>
        Task{!taskNeeded && <span className="font-normal text-text-muted"> (optional)</span>}
      </label>
      <select
        id={`${id}-task`}
        value={line.service_task_id}
        onChange={(event) => onChange({ service_task_id: event.target.value })}
        className={inputClass}
        aria-required={taskNeeded}
        aria-invalid={taskInvalid || undefined}
        aria-describedby={taskInvalid ? problemId : undefined}
        disabled={disabled || !line.service_type_id || tasks.length === 0}
      >
        <option value="">{line.service_type_id ? (tasks.length ? (taskNeeded ? 'Choose task…' : 'No task') : 'No tasks for this category') : 'Choose a category first'}</option>
        {tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}
      </select>
    </div>
  )

  const changeClient = (clientId: string) => {
    const nextClient = clients.find((option) => String(option.id) === clientId) ?? null
    const stillValid = !line.service_type_id || categoriesForClient(serviceTypes, nextClient).some((type) => String(type.id) === line.service_type_id)
    onChange({ client_id: clientId, ...(stillValid ? {} : { service_type_id: '', service_task_id: '' }) })
  }

  return (
    <li
      className={`rounded-xl border bg-white p-3 ${problems.length ? 'border-amber-300' : 'border-neutral-warm'} ${
        wholeSession ? 'space-y-3' : `space-y-3 @4xl:grid ${gridColumns} @4xl:items-start @4xl:gap-2 @4xl:space-y-0 @4xl:p-2`
      }`}
      aria-label={lineName}
    >
      {count > 1 && <p className="text-xs font-semibold uppercase tracking-wide text-text-muted @4xl:hidden">{lineName}</p>}

      <WorkLineClientField
        id={`${id}-client`}
        label={`${lineName} client`}
        visibleLabel={wholeSession ? 'Client' : undefined}
        value={line.client_id}
        onChange={changeClient}
        clients={clients}
        recentClients={suggestions?.recentClients || []}
        required={required}
        disabled={disabled}
        describedBy={problems.length ? problemId : undefined}
      />

      <div>
        <label htmlFor={`${id}-description`} className={wholeSession ? labelClass : `${labelClass} @4xl:sr-only`}>What I did</label>
        {/* One line of text that wraps and grows, so a long description stays
            readable while it's edited instead of being cut off. */}
        <GrowingTextField
          id={`${id}-description`}
          value={line.description}
          onChange={(description) => onChange({ description })}
          placeholder="e.g. Reconciled June bank statements"
          className={`${inputClass} resize-none overflow-hidden leading-snug`}
          aria-label={wholeSession ? undefined : `${lineName} description`}
          aria-required={required}
          aria-describedby={problems.length ? problemId : undefined}
          disabled={disabled}
        />
        {descriptionChips.length > 0 && !line.description && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label={`Recent descriptions for ${lineName.toLowerCase()}`}>
            {descriptionChips.map((text) => (
              <button key={text} type="button" className={chipClass} onClick={() => onChange({ description: text })} disabled={disabled}>
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor={`${id}-category`} className={wholeSession ? labelClass : `${labelClass} @4xl:sr-only`}>
          Category{!categoryNeeded && <span className="font-normal text-text-muted"> (optional)</span>}
        </label>
        <select
          id={`${id}-category`}
          value={line.service_type_id}
          onChange={(event) => onChange({ service_type_id: event.target.value, service_task_id: '' })}
          className={inputClass}
          aria-label={wholeSession ? undefined : `${lineName} category`}
          aria-required={categoryNeeded}
          aria-invalid={categoryInvalid || undefined}
          aria-describedby={categoryInvalid ? problemId : undefined}
          disabled={disabled}
        >
          <option value="">{categoryNeeded ? 'Choose category…' : 'No category'}</option>
          {categories.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          {category && !categories.includes(category) && <option value={category.id}>{category.name}</option>}
        </select>
        {taskRequired && taskField}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          aria-expanded={showMore}
          aria-controls={`${id}-more`}
          className="min-h-11 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {taskRequired ? (showMore ? 'Hide period' : 'Period') : (showMore ? 'Hide task and period' : 'Task and period')}
        </button>
      </div>

      {/* Task and period open across the whole line (their own row in the
          table) instead of squeezing into the category column. */}
      {showMore && (
        <div
          id={`${id}-more`}
          className={`space-y-2 rounded-lg bg-secondary/30 p-2 @4xl:col-span-full @4xl:row-start-2 ${
            taskRequired ? '' : '@xl:grid @xl:grid-cols-2 @xl:items-start @xl:gap-3 @xl:space-y-0'
          }`}
        >
          {!taskRequired && taskField}
          <PeriodPicker
            idPrefix={`${id}-period`}
            value={{ period_type: line.period_type, period_start: line.period_start }}
            onChange={(period) => onChange({ period_type: period.period_type, period_start: period.period_start })}
            referenceDate={referenceDate}
            className={inputClass}
            stacked
          />
        </div>
      )}

      {wholeSession ? (
        <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-primary-dark">
          Time: <span className="font-semibold">the whole session</span>
          {minutes !== null && <span className="tabular-nums"> · {formatMinutes(minutes)}</span>}
        </p>
      ) : (
        <DurationField
          id={`${id}-time`}
          label={`${lineName} time`}
          line={line}
          minutes={minutes}
          onChange={onChange}
          onEnter={onEnterOnTime}
          disabled={disabled}
          describedBy={problems.length ? problemId : undefined}
        />
      )}

      {!wholeSession && (
        <div className="flex flex-wrap gap-1 @4xl:flex-col @4xl:items-stretch">
          {remainingMinutes !== null && remainingMinutes !== 0 && (minutes ?? 0) + remainingMinutes > 0 && (
            <button type="button" onClick={onAbsorbRemaining} disabled={disabled} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5"
              aria-label={`${remainingMinutes > 0 ? 'Add' : 'Take'} ${formatMinutes(Math.abs(remainingMinutes))} ${remainingMinutes > 0 ? 'to' : 'from'} ${lineName.toLowerCase()}`}>
              {remainingMinutes > 0 ? `+${formatMinutes(remainingMinutes)}` : `−${formatMinutes(-remainingMinutes)}`}
            </button>
          )}
          <button type="button" onClick={onDuplicate} disabled={disabled} className="min-h-11 rounded-lg px-2 text-xs font-medium text-primary-dark hover:bg-secondary" aria-label={`Duplicate ${lineName.toLowerCase()}`}>
            Duplicate
          </button>
          <button type="button" onClick={onRemove} disabled={disabled} className="min-h-11 rounded-lg px-2 text-xs font-medium text-red-600 hover:bg-red-50" aria-label={`Remove ${lineName.toLowerCase()}`}>
            Remove
          </button>
        </div>
      )}

      {problems.length > 0 && (
        <p id={problemId} className="text-sm text-amber-800 @4xl:col-span-full">{problems.join(' · ')}</p>
      )}
    </li>
  )
}

function WorkLineClientField({
  id,
  label,
  visibleLabel,
  value,
  onChange,
  clients,
  recentClients,
  required,
  disabled,
  describedBy,
}: {
  id: string
  label: string
  visibleLabel?: string
  value: string
  onChange: (clientId: string) => void
  clients: ClientOption[]
  recentClients: ClientOption[]
  required: boolean
  disabled: boolean
  describedBy?: string
}) {
  const [query, setQuery] = useState('')
  const sorted = useMemo(() => sortClientOptions(clients), [clients])
  const matches = useMemo(() => filterClientOptions(sorted, query), [sorted, query])
  const recent = recentClients.filter((client) => clients.some((option) => option.id === client.id)).slice(0, 4)
  const selected = sorted.find((client) => String(client.id) === value)
  const visible = selected && !matches.includes(selected) ? [selected, ...matches] : matches
  const groups = ['Cornerstone', 'Businesses', 'Individuals']
    .map((group) => ({ group, options: visible.filter((client) => clientGroupLabel(client) === group) }))
    .filter((group) => group.options.length)
  const recentInList = query ? [] : recent

  return (
    <div>
      <label htmlFor={id} className={visibleLabel ? labelClass : `${labelClass} @4xl:sr-only`}>{visibleLabel || 'Client'}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        aria-label={visibleLabel ? undefined : label}
        aria-required={required}
        aria-describedby={describedBy}
        disabled={disabled}
      >
        <option value="">{required ? 'Choose client…' : INTERNAL_CLIENT_LABEL}</option>
        {recentInList.length > 0 && (
          <optgroup label="Recent">
            {recentInList.map((client) => <option key={`recent-${client.id}`} value={client.id}>{clientOptionLabel(client)}</option>)}
          </optgroup>
        )}
        {groups.map(({ group, options }) => (
          <optgroup key={group} label={group}>
            {options.map((client) => <option key={client.id} value={client.id}>{clientOptionLabel(client)}</option>)}
          </optgroup>
        ))}
      </select>
      {/* The search narrows the list above. It sits under the select so the
          select lines up with the other fields in the row. */}
      {sorted.length > 6 && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients"
          aria-label={`Search clients for ${label.toLowerCase()}`}
          aria-controls={id}
          className={`${inputClass} mt-2`}
          disabled={disabled}
        />
      )}
      {query && <p className="mt-1 text-xs text-text-muted" aria-live="polite">{matches.length === 0 ? 'No clients match' : `${matches.length} match${matches.length === 1 ? '' : 'es'}`}</p>}
      {!value && recent.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label={`Recent clients for ${label.toLowerCase()}`}>
          {recent.map((client) => (
            <button key={client.id} type="button" className={chipClass} onClick={() => onChange(String(client.id))} disabled={disabled}>
              {clientOptionLabel(client)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DurationField({
  id,
  label,
  line,
  minutes,
  onChange,
  onEnter,
  disabled,
  describedBy,
}: {
  id: string
  label: string
  line: WorkLineDraft
  minutes: number | null
  onChange: (patch: Partial<WorkLineDraft>) => void
  onEnter?: () => void
  disabled: boolean
  describedBy?: string
}) {
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className={`${labelClass} @4xl:sr-only`}>Time</label>
      <div className="flex items-start gap-1">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={line.durationText}
          onChange={(event) => onChange({ durationText: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onEnter) {
              event.preventDefault()
              onEnter()
            }
          }}
          placeholder={line.unit === 'hours' ? '1.5' : '45'}
          className={`${inputClass} min-w-0 tabular-nums`}
          aria-label={label}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
          disabled={disabled}
          enterKeyHint={onEnter ? 'enter' : 'done'}
          autoComplete="off"
        />
        {/* The frame is an inset outline, not a border, so the group stays
            44px tall like the input beside it (a border made it 46px). */}
        <div role="group" aria-label={`${label} unit`} className="flex shrink-0 overflow-hidden rounded-lg outline outline-1 -outline-offset-1 outline-neutral-warm">
          {(['minutes', 'hours'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={line.unit === unit}
              onClick={() => onChange({ unit })}
              disabled={disabled}
              className={`min-h-11 min-w-11 px-2 text-sm font-semibold ${line.unit === unit ? 'bg-primary text-white' : 'bg-white text-primary-dark hover:bg-secondary'}`}
            >
              {unit === 'minutes' ? 'min' : 'h'}
            </button>
          ))}
        </div>
      </div>
      <p id={hintId} className="mt-1 text-xs tabular-nums text-text-muted">
        {minutes !== null && minutes > 0 ? `= ${formatMinutes(minutes)} (${minutesToHoursText(minutes)}h)` : 'Minutes or hours, e.g. 45 or 1.5h'}
      </p>
    </div>
  )
}

/**
 * A single-line text field that wraps long text and grows to fit it. Enter
 * doesn't add a line break (descriptions stay one line), and pasted line
 * breaks become spaces.
 */
function GrowingTextField({
  id,
  value,
  onChange,
  className,
  ...rest
}: {
  id: string
  value: string
  onChange: (value: string) => void
  className: string
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-required'?: boolean
  'aria-describedby'?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [value])

  // The field also changes width (splitting a session moves it into a column), so re-measure then too.
  useEffect(() => {
    const field = ref.current
    if (!field || typeof ResizeObserver === 'undefined') return
    let width = field.clientWidth
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return
      width = field.clientWidth
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [])

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, ' '))}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      className={className}
      enterKeyHint="next"
      autoComplete="off"
      {...rest}
    />
  )
}
