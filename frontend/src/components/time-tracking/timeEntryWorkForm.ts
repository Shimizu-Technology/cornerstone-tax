import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { ServiceType } from '../../lib/api'
import { isPeriodType, type ClientOption, type PeriodType, type WorkPeriod } from '../../lib/timeEntryWork'

interface NamedRef { id: number; name: string }

export interface WorkFieldsValue extends WorkPeriod {
  client_id: string
  service_type_id: string
  service_task_id: string
  description: string
}

export const EMPTY_WORK_FIELDS: WorkFieldsValue = {
  client_id: '',
  service_type_id: '',
  service_task_id: '',
  period_type: '',
  period_start: '',
  description: '',
}

/** What an existing entry already has, so editing never drops a value that is no longer listed. */
export interface CurrentWorkSelection {
  client?: NamedRef | null
  service_type?: NamedRef | null
  service_task?: NamedRef | null
  time_category?: NamedRef | null
}

interface EntryWithWork extends CurrentWorkSelection {
  description?: string | null
  period_type?: string | null
  period_start?: string | null
}

export function workFieldsFromEntry(entry: EntryWithWork): WorkFieldsValue {
  return {
    client_id: entry.client?.id.toString() || '',
    service_type_id: entry.service_type?.id.toString() || '',
    service_task_id: entry.service_task?.id.toString() || '',
    period_type: isPeriodType(entry.period_type) ? entry.period_type : '',
    period_start: isPeriodType(entry.period_type) ? entry.period_start || '' : '',
    description: entry.description || '',
  }
}

const toId = (value: string) => (value ? parseInt(value, 10) : null)

/**
 * API payload for the work fields. Legacy time_category_id is never sent, so
 * editing an older entry keeps its original category.
 */
export function workFieldsPayload(value: WorkFieldsValue) {
  const hasPeriod = isPeriodType(value.period_type) && Boolean(value.period_start)
  return {
    client_id: toId(value.client_id),
    service_type_id: toId(value.service_type_id),
    service_task_id: value.service_type_id ? toId(value.service_task_id) : null,
    period_type: hasPeriod ? value.period_type as PeriodType : null,
    period_start: hasPeriod ? value.period_start : null,
    description: value.description,
  }
}

export type WorkFieldsPayload = ReturnType<typeof workFieldsPayload>

/**
 * Only the work fields the user changed, so saving an edit never overwrites
 * details someone else saved meanwhile. Category and task travel together
 * when the category changes, as do the two period fields.
 */
export function changedWorkFieldsPayload(initial: WorkFieldsValue, current: WorkFieldsValue): Partial<WorkFieldsPayload> {
  const before = workFieldsPayload(initial)
  const after = workFieldsPayload(current)
  const changes: Partial<WorkFieldsPayload> = {}

  if (before.client_id !== after.client_id) changes.client_id = after.client_id
  if (before.service_type_id !== after.service_type_id) {
    changes.service_type_id = after.service_type_id
    changes.service_task_id = after.service_task_id
  } else if (before.service_task_id !== after.service_task_id) {
    changes.service_task_id = after.service_task_id
  }
  if (before.period_type !== after.period_type || before.period_start !== after.period_start) {
    changes.period_type = after.period_type
    changes.period_start = after.period_start
  }
  if (before.description !== after.description) changes.description = after.description

  return changes
}

/**
 * Loads the active categories (with tasks) and the client picker list.
 * A failed request is not cached: `error` explains it and `retry` reloads
 * only what failed, keeping whatever already loaded.
 */
export function useTimeEntryWorkOptions(enabled = true) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loadedParts, setLoadedParts] = useState({ serviceTypes: false, clients: false })
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Read inside the effect without re-running it when one part finishes.
  const loadedRef = useRef(loadedParts)
  const loaded = loadedParts.serviceTypes && loadedParts.clients

  useEffect(() => {
    if (!enabled) return
    const done = loadedRef.current
    if (done.serviceTypes && done.clients) return
    let cancelled = false

    const markLoaded = (part: 'serviceTypes' | 'clients') => {
      loadedRef.current = { ...loadedRef.current, [part]: true }
      setLoadedParts(loadedRef.current)
    }
    const typesRequest = done.serviceTypes ? Promise.resolve(true) : api.getServiceTypes().then((response) => {
      if (cancelled || !response.data) return false
      setServiceTypes(response.data.service_types)
      markLoaded('serviceTypes')
      return true
    }).catch(() => false)
    const clientsRequest = done.clients ? Promise.resolve(true) : api.getClientOptions().then((response) => {
      if (cancelled || !response.data) return false
      setClients(response.data.clients)
      markLoaded('clients')
      return true
    }).catch(() => false)

    void Promise.all([typesRequest, clientsRequest]).then(([typesOk, clientsOk]) => {
      if (cancelled) return
      const failed = [typesOk ? null : 'categories', clientsOk ? null : 'clients'].filter(Boolean)
      setError(failed.length ? `Couldn't load ${failed.join(' or ')}. Check your connection and try again.` : null)
    })
    return () => { cancelled = true }
  }, [enabled, attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  return { serviceTypes, clients, loaded, error, retry }
}
