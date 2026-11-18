import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_WORK_FIELDS, changedWorkFieldsPayload, useTimeEntryWorkOptions } from './timeEntryWorkForm'

const apiMock = vi.hoisted(() => ({ getServiceTypes: vi.fn(), getClientOptions: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: apiMock }))

describe('changedWorkFieldsPayload', () => {
  const initial = { ...EMPTY_WORK_FIELDS, client_id: '5', service_type_id: '1', service_task_id: '11', period_type: 'month' as const, period_start: '2026-07-01', description: 'Rec' }

  it('sends nothing when nothing changed', () => {
    expect(changedWorkFieldsPayload(initial, { ...initial })).toEqual({})
  })

  it('sends both period fields when either changes, including a clear', () => {
    expect(changedWorkFieldsPayload(initial, { ...initial, period_start: '2026-08-01' })).toEqual({ period_type: 'month', period_start: '2026-08-01' })
    expect(changedWorkFieldsPayload(initial, { ...initial, period_type: '', period_start: '' })).toEqual({ period_type: null, period_start: null })
  })

  it('sends the task with a changed category', () => {
    expect(changedWorkFieldsPayload(initial, { ...initial, service_type_id: '2', service_task_id: '' })).toEqual({ service_type_id: 2, service_task_id: null })
    expect(changedWorkFieldsPayload(initial, { ...initial, service_task_id: '12' })).toEqual({ service_task_id: 12 })
  })

  it('sends a cleared client and changed comments', () => {
    expect(changedWorkFieldsPayload(initial, { ...initial, client_id: '', description: '' })).toEqual({ client_id: null, description: '' })
  })
})

describe('useTimeEntryWorkOptions', () => {
  beforeEach(() => {
    apiMock.getServiceTypes.mockReset()
    apiMock.getClientOptions.mockReset()
  })

  it('does not cache a failed request as loaded and retries only what failed', async () => {
    apiMock.getServiceTypes.mockResolvedValue({ data: { service_types: [{ id: 1, name: 'Bookkeeping' }] } })
    apiMock.getClientOptions
      .mockResolvedValueOnce({ error: 'Server error' })
      .mockResolvedValueOnce({ data: { clients: [{ id: 5, name: "MoSa's" }] } })

    const { result } = renderHook(() => useTimeEntryWorkOptions())

    await waitFor(() => expect(result.current.error).toContain('clients'))
    expect(result.current.loaded).toBe(false)
    expect(result.current.serviceTypes).toHaveLength(1)

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.error).toBeNull()
    expect(result.current.clients).toEqual([{ id: 5, name: "MoSa's" }])
    expect(apiMock.getServiceTypes).toHaveBeenCalledTimes(1)
    expect(apiMock.getClientOptions).toHaveBeenCalledTimes(2)
  })
})
