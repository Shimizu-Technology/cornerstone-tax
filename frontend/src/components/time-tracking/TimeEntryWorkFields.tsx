import { useId, useMemo, useState } from 'react'
import type { ServiceType } from '../../lib/api'
import {
  INTERNAL_CLIENT_LABEL,
  MONTH_NAMES,
  PERIOD_TYPES,
  clientOptionLabel,
  filterClientOptions,
  isPeriodType,
  periodLabel,
  periodParts,
  periodStartContaining,
  periodStartFor,
  quarterName,
  sortClientOptions,
  type ClientOption,
  type WorkPeriod,
} from '../../lib/timeEntryWork'
import type { CurrentWorkSelection, WorkFieldsValue } from './timeEntryWorkForm'

const inputClass = 'w-full rounded-lg border border-neutral-warm bg-white px-3 py-2 text-base sm:text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-neutral-warm/30 disabled:text-text-muted'
const labelClass = 'mb-1 block text-sm font-medium text-primary-dark'

interface NamedRef { id: number; name: string }

function withCurrent<T extends { id: number }>(options: T[], current: T | null | undefined): T[] {
  if (!current || options.some((option) => option.id === current.id)) return options
  return [...options, current]
}

export function ClientPicker({
  id,
  label = 'Client',
  hint,
  value,
  onChange,
  clients,
  current,
  emptyLabel = INTERNAL_CLIENT_LABEL,
  className = inputClass,
  labelClassName = labelClass,
}: {
  id?: string
  label?: string
  hint?: string
  value: string
  onChange: (clientId: string) => void
  clients: ClientOption[]
  current?: NamedRef | null
  emptyLabel?: string
  className?: string
  labelClassName?: string
}) {
  const generatedId = useId()
  const selectId = id || `${generatedId}-client`
  const [query, setQuery] = useState('')
  const allOptions = useMemo(() => sortClientOptions(withCurrent<ClientOption>(clients, current ?? null)), [clients, current])
  const visibleOptions = useMemo(() => {
    const matches = filterClientOptions(allOptions, query)
    const selected = allOptions.find((client) => String(client.id) === value)
    return selected && !matches.includes(selected) ? [selected, ...matches] : matches
  }, [allOptions, query, value])
  const searchable = allOptions.length > 6

  return (
    <div>
      <label htmlFor={selectId} className={labelClassName}>
        {label}{hint && <span className="font-normal text-text-muted"> {hint}</span>}
      </label>
      {searchable && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search business or contact name"
          aria-label={`Search ${label.toLowerCase()} list`}
          className={`${className} mb-2`}
        />
      )}
      <select id={selectId} value={value} onChange={(event) => onChange(event.target.value)} className={className}>
        <option value="">{emptyLabel}</option>
        {visibleOptions.map((client) => (
          <option key={client.id} value={client.id}>{clientOptionLabel(client)}</option>
        ))}
      </select>
      {searchable && query && (
        <p className="mt-1 text-xs text-text-muted" aria-live="polite">
          {visibleOptions.length === 0 ? 'No clients match' : `${visibleOptions.length} match${visibleOptions.length === 1 ? '' : 'es'}`}
        </p>
      )}
    </div>
  )
}

function yearOptions(selectedYear: number | null) {
  const currentYear = new Date().getFullYear()
  const first = Math.min(currentYear - 6, selectedYear ?? currentYear)
  const last = Math.max(currentYear + 1, selectedYear ?? currentYear)
  return Array.from({ length: last - first + 1 }, (_, index) => last - index)
}

export function PeriodPicker({
  idPrefix,
  label = 'Period',
  hint = '(optional)',
  value,
  onChange,
  referenceDate,
  emptyLabel = 'No period',
  className = inputClass,
  labelClassName = labelClass,
}: {
  idPrefix?: string
  label?: string
  hint?: string
  value: WorkPeriod
  onChange: (value: WorkPeriod) => void
  /** Date used to prefill the period when a type is first chosen (YYYY-MM-DD). */
  referenceDate?: string
  emptyLabel?: string
  className?: string
  labelClassName?: string
}) {
  const generatedId = useId()
  const prefix = idPrefix || generatedId
  const type = isPeriodType(value.period_type) ? value.period_type : ''
  const parts = type && value.period_start ? periodParts(type, value.period_start) : null
  const years = yearOptions(parts?.year ?? null)
  const preview = periodLabel(type, value.period_start)

  const changeType = (nextType: string) => {
    if (!isPeriodType(nextType)) {
      onChange({ period_type: '', period_start: '' })
      return
    }
    const base = value.period_start || referenceDate || new Date().toISOString().slice(0, 10)
    onChange({ period_type: nextType, period_start: periodStartContaining(nextType, base) })
  }

  const changePart = (part: number) => {
    if (!type || !parts) return
    onChange({ period_type: type, period_start: periodStartFor(type, parts.year, part) })
  }

  const changeYear = (year: number) => {
    if (!type) return
    onChange({ period_type: type, period_start: periodStartFor(type, year, parts?.part ?? 1) })
  }

  return (
    <fieldset>
      <legend className={labelClassName}>
        {label}{hint && <span className="font-normal text-text-muted"> {hint}</span>}
      </legend>
      <div className={`grid gap-2 ${type === 'month' || type === 'quarter' ? 'grid-cols-1 sm:grid-cols-[1fr_1.2fr_1fr]' : type === 'year' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <select id={`${prefix}-period-type`} aria-label={`${label} type`} value={type} onChange={(event) => changeType(event.target.value)} className={className}>
          <option value="">{emptyLabel}</option>
          {PERIOD_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {type === 'month' && parts && (
          <select aria-label={`${label} month`} value={parts.part} onChange={(event) => changePart(Number(event.target.value))} className={className}>
            {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
        )}
        {type === 'quarter' && parts && (
          <select aria-label={`${label} quarter`} value={parts.part} onChange={(event) => changePart(Number(event.target.value))} className={className}>
            {[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>{quarterName(quarter)}</option>)}
          </select>
        )}
        {type && parts && (
          <select aria-label={`${label} year`} value={parts.year} onChange={(event) => changeYear(Number(event.target.value))} className={className}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        )}
      </div>
      {preview && <p className="mt-1 text-xs text-text-muted">Recorded as <span className="font-semibold text-primary-dark">{preview}</span></p>}
    </fieldset>
  )
}

/** One category filter covering current categories and legacy time categories (values "st:<id>" / "tc:<id>"). */
export function CategoryFilterSelect({
  id,
  value,
  onChange,
  serviceTypes,
  legacyCategories,
  className,
  allLabel = 'All Categories',
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  serviceTypes: ServiceType[]
  legacyCategories: NamedRef[]
  className?: string
  allLabel?: string
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      <option value="">{allLabel}</option>
      {serviceTypes.map(type => <option key={`st-${type.id}`} value={`st:${type.id}`}>{type.name}</option>)}
      {legacyCategories.length > 0 && (
        <optgroup label="Legacy categories">
          {legacyCategories.map(category => <option key={`tc-${category.id}`} value={`tc:${category.id}`}>{category.name} (legacy)</option>)}
        </optgroup>
      )}
    </select>
  )
}

export default function TimeEntryWorkFields({
  value,
  onChange,
  clients,
  serviceTypes,
  current,
  referenceDate,
  commentsPlaceholder = 'Optional notes about this work',
  idPrefix,
}: {
  value: WorkFieldsValue
  onChange: (value: WorkFieldsValue) => void
  clients: ClientOption[]
  serviceTypes: ServiceType[]
  current?: CurrentWorkSelection | null
  referenceDate?: string
  commentsPlaceholder?: string
  idPrefix?: string
}) {
  const generatedId = useId()
  const prefix = idPrefix || generatedId
  const categoryOptions = withCurrent<NamedRef & { inactive?: boolean }>(
    [...serviceTypes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)),
    current?.service_type ? { ...current.service_type, inactive: true } : null,
  )
  const selectedCategory = serviceTypes.find((type) => String(type.id) === value.service_type_id)
  const categoryTasks = [...(selectedCategory?.tasks || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
  const currentTask = current?.service_task && String(current.service_type?.id) === value.service_type_id ? { ...current.service_task, inactive: true } : null
  const taskOptions = withCurrent<NamedRef & { inactive?: boolean }>(categoryTasks, currentTask)
  const legacyCategory = !current?.service_type && current?.time_category ? current.time_category : null

  const update = (patch: Partial<WorkFieldsValue>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4" data-testid="time-entry-work-fields">
      <ClientPicker
        id={`${prefix}-client`}
        hint="(optional)"
        value={value.client_id}
        onChange={(client_id) => update({ client_id })}
        clients={clients}
        current={current?.client}
      />

      <div>
        <label htmlFor={`${prefix}-category`} className={labelClass}>Category</label>
        <select
          id={`${prefix}-category`}
          value={value.service_type_id}
          onChange={(event) => update({ service_type_id: event.target.value, service_task_id: '' })}
          className={inputClass}
        >
          <option value="">Select category…</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>{category.name}{category.inactive ? ' (inactive)' : ''}</option>
          ))}
        </select>
        {legacyCategory && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Legacy category: <span className="font-semibold">{legacyCategory.name}</span>. It stays on this entry; choose a category to add the new detail.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${prefix}-task`} className={labelClass}>Task</label>
        <select
          id={`${prefix}-task`}
          value={value.service_task_id}
          onChange={(event) => update({ service_task_id: event.target.value })}
          disabled={!value.service_type_id}
          className={inputClass}
        >
          <option value="">{value.service_type_id ? (taskOptions.length ? 'Select task…' : 'No tasks for this category') : 'Choose a category first'}</option>
          {taskOptions.map((task) => (
            <option key={task.id} value={task.id}>{task.name}{task.inactive ? ' (inactive)' : ''}</option>
          ))}
        </select>
      </div>

      <PeriodPicker
        idPrefix={prefix}
        value={value}
        referenceDate={referenceDate}
        onChange={(period) => update(period)}
      />

      <div>
        <label htmlFor={`${prefix}-comments`} className={labelClass}>Comments</label>
        <textarea
          id={`${prefix}-comments`}
          value={value.description}
          onChange={(event) => update({ description: event.target.value })}
          rows={3}
          placeholder={commentsPlaceholder}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  )
}
