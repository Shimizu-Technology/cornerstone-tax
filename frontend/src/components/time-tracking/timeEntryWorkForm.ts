import { useEffect, useState } from 'react'
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

/** Loads the active categories (with tasks) and the client picker list. */
export function useTimeEntryWorkOptions(enabled = true) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled || loaded) return
    let cancelled = false
    Promise.all([api.getServiceTypes(), api.getClientOptions()])
      .then(([serviceTypeResponse, clientResponse]) => {
        if (cancelled) return
        if (serviceTypeResponse.data) setServiceTypes(serviceTypeResponse.data.service_types)
        if (clientResponse.data) setClients(clientResponse.data.clients)
        setLoaded(true)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [enabled, loaded])

  return { serviceTypes, clients, loaded }
}

