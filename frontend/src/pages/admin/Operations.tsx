import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { OperationTaskItem, UserSummary } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'

type ViewMode = 'team' | 'my'
type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming'
type GroupBy = 'status' | 'client' | 'assignee'
type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'blocked' | 'done'

interface SavedQuickFilter {
  id: string
  name: string
  viewMode: ViewMode
  dueFilter: DueFilter
  statusFilter: StatusFilter
  includeDone: boolean
  groupBy: GroupBy
  assignedToId: string
}

const SAVED_FILTERS_KEY = 'operations.savedQuickFilters.v1'

export default function OperationsPage() {
  useEffect(() => {
    document.title = 'Operations | Cornerstone Admin'
  }, [])

  const [viewMode, setViewMode] = useState<ViewMode>('team')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [includeDone, setIncludeDone] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [assignedToId, setAssignedToId] = useState('')
  const [saveFilterName, setSaveFilterName] = useState('')
  const [savedQuickFilters, setSavedQuickFilters] = useState<SavedQuickFilter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<OperationTaskItem[]>([])
  const [staffUsers, setStaffUsers] = useState<UserSummary[]>([])
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as SavedQuickFilter[]
      if (Array.isArray(parsed)) setSavedQuickFilters(parsed)
    } catch {
      // Ignore malformed saved filters in local storage.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(savedQuickFilters))
  }, [savedQuickFilters])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersResult, tasksResult] = await Promise.all([
        api.getUsers(),
        viewMode === 'my'
          ? api.getMyOperationTasks({
              status: statusFilter === 'all' ? undefined : statusFilter,
              due_filter: dueFilter === 'all' ? undefined : dueFilter,
              include_done: includeDone,
              limit: 300,
            })
          : api.getOperationTasks({
              assigned_to_id: assignedToId ? parseInt(assignedToId) : undefined,
              status: statusFilter === 'all' ? undefined : statusFilter,
              due_filter: dueFilter === 'all' ? undefined : dueFilter,
              include_done: includeDone,
              limit: 300,
            }),
      ])

      if (usersResult.data) {
        setStaffUsers(usersResult.data.users.filter(u => u.role === 'admin' || u.role === 'employee'))
      }

      if (tasksResult.data) {
        setTasks(tasksResult.data.operation_tasks)
      } else if (tasksResult.error) {
        setError(tasksResult.error)
      }
    } catch (err) {
      console.error('Failed to load operations tasks:', err)
      setError('Failed to load operations tasks')
    } finally {
      setLoading(false)
    }
  }, [assignedToId, dueFilter, includeDone, statusFilter, viewMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  const tasksForDisplay = useMemo(() => {
    const list = [...tasks]
    if (viewMode !== 'my') return list

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const statusPriority: Record<OperationTaskItem['status'], number> = {
      in_progress: 0,
      blocked: 1,
      not_started: 2,
      done: 3,
    }
    const urgencyScore = (task: OperationTaskItem) => {
      if (task.status === 'done') return 99
      if (!task.due_at) return 80
      const due = new Date(task.due_at).getTime()
      if (due < now) return 0
      if (due <= now + dayMs) return 1
      if (due <= now + (3 * dayMs)) return 2
      if (due <= now + (7 * dayMs)) return 3
      return 4
    }

    list.sort((a, b) => {
      const scoreDiff = urgencyScore(a) - urgencyScore(b)
      if (scoreDiff !== 0) return scoreDiff

      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
      if (aDue !== bDue) return aDue - bDue

      const statusDiff = statusPriority[a.status] - statusPriority[b.status]
      if (statusDiff !== 0) return statusDiff

      return a.title.localeCompare(b.title)
    })

    return list
  }, [tasks, viewMode])

  const groupedTasks = useMemo(() => {
    const grouped: Record<string, OperationTaskItem[]> = {}

    tasksForDisplay.forEach(task => {
      let key = 'Other'
      if (groupBy === 'status') key = task.status.replace('_', ' ')
      if (groupBy === 'client') key = task.client_name || 'Unknown client'
      if (groupBy === 'assignee') key = task.assigned_to?.name || 'Unassigned'

      if (!grouped[key]) grouped[key] = []
      grouped[key].push(task)
    })

    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))
  }, [groupBy, tasksForDisplay])

  const applyQuickPreset = (
    preset: Partial<Pick<SavedQuickFilter, 'viewMode' | 'dueFilter' | 'statusFilter' | 'includeDone' | 'groupBy' | 'assignedToId'>>
  ) => {
    if (preset.viewMode) setViewMode(preset.viewMode)
    if (preset.dueFilter) setDueFilter(preset.dueFilter)
    if (preset.statusFilter) setStatusFilter(preset.statusFilter)
    if (preset.includeDone !== undefined) setIncludeDone(preset.includeDone)
    if (preset.groupBy) setGroupBy(preset.groupBy)
    if (preset.assignedToId !== undefined) setAssignedToId(preset.assignedToId)
  }

  const handleSaveQuickFilter = () => {
    const trimmedName = saveFilterName.trim()
    if (!trimmedName) return
    const newFilter: SavedQuickFilter = {
      id: `${Date.now()}`,
      name: trimmedName,
      viewMode,
      dueFilter,
      statusFilter,
      includeDone,
      groupBy,
      assignedToId,
    }
    setSavedQuickFilters(prev => [newFilter, ...prev].slice(0, 8))
    setSaveFilterName('')
  }

  const handleDeleteQuickFilter = (id: string) => {
    setSavedQuickFilters(prev => prev.filter(filter => filter.id !== id))
  }

  const handleQuickStatus = async (task: OperationTaskItem, nextStatus: OperationTaskItem['status']) => {
    setSavingTaskId(task.id)
    setError(null)
    try {
      if (nextStatus === 'done') {
        const result = await api.completeOperationTask(task.id, task.evidence_required ? 'Completed from operations board' : undefined)
        if (result.error) setError(result.error)
      } else if (task.status === 'done') {
        const result = await api.reopenOperationTask(task.id)
        if (result.error) setError(result.error)
      } else {
        const result = await api.updateOperationTask(task.id, { status: nextStatus })
        if (result.error) setError(result.error)
      }
      await loadData()
    } catch (err) {
      console.error('Failed to update task status:', err)
      setError('Failed to update task status')
    } finally {
      setSavingTaskId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark tracking-tight">Operations</h1>
        <p className="text-text-muted mt-1">Team operational board with quick filters for overdue and assigned work.</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-warm shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={`min-h-11 px-4 py-2 rounded-xl text-sm font-medium ${
              viewMode === 'team' ? 'bg-primary text-white' : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
            }`}
          >
            Team Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode('my')}
            className={`min-h-11 px-4 py-2 rounded-xl text-sm font-medium ${
              viewMode === 'my' ? 'bg-primary text-white' : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
            }`}
          >
            My Tasks
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyQuickPreset({ dueFilter: 'overdue', statusFilter: 'all', includeDone: false })}
            className="min-h-11 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-warm text-primary-dark hover:bg-secondary-dark"
          >
            Overdue
          </button>
          <button
            type="button"
            onClick={() => applyQuickPreset({ dueFilter: 'today', statusFilter: 'all', includeDone: false })}
            className="min-h-11 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-warm text-primary-dark hover:bg-secondary-dark"
          >
            Due Today
          </button>
          <button
            type="button"
            onClick={() => applyQuickPreset({ dueFilter: 'all', statusFilter: 'blocked', includeDone: false })}
            className="min-h-11 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-warm text-primary-dark hover:bg-secondary-dark"
          >
            Blocked
          </button>
          <button
            type="button"
            onClick={() => applyQuickPreset({ viewMode: 'my', dueFilter: 'today', statusFilter: 'all', includeDone: false })}
            className="min-h-11 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-warm text-primary-dark hover:bg-secondary-dark"
          >
            My Tasks Today
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as DueFilter)}
            className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
          >
            <option value="all">All Due Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming (2 weeks)</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
          >
            <option value="status">Group by Status</option>
            <option value="client">Group by Client</option>
            <option value="assignee">Group by Assignee</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>

          {viewMode === 'team' && (
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm"
            >
              <option value="">All Assignees</option>
              {staffUsers.map(user => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </select>
          )}

          <label className="min-h-11 inline-flex items-center gap-2 px-3 py-2 border border-neutral-warm rounded-xl text-sm">
            <input
              type="checkbox"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
            />
            Include Done
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              className="min-h-11 px-3 py-2 border border-neutral-warm rounded-xl text-sm flex-1"
              placeholder="Save current filter set"
            />
            <button
              type="button"
              onClick={handleSaveQuickFilter}
              disabled={!saveFilterName.trim()}
              className="min-h-11 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Save Quick Filter
            </button>
          </div>
          {savedQuickFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedQuickFilters.map(filter => (
                <div key={filter.id} className="inline-flex items-center border border-neutral-warm rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => applyQuickPreset(filter)}
                    className="min-h-11 px-3 py-2 text-xs font-medium text-primary-dark hover:bg-neutral-warm"
                  >
                    {filter.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuickFilter(filter.id)}
                    aria-label={`Delete quick filter ${filter.name}`}
                    className="min-h-11 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : groupedTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-warm shadow-sm p-8 text-center text-text-muted">
          No operation tasks matched these filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTasks.map(([groupName, items]) => (
            <div key={groupName} className="bg-white rounded-2xl border border-neutral-warm shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-secondary border-b border-neutral-warm flex items-center justify-between">
                <h2 className="font-semibold text-primary-dark">{groupName}</h2>
                <span className="text-xs text-text-muted">{items.length} task{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-neutral-warm">
                {items.map(task => (
                  <div key={task.id} className="p-4 space-y-3">
                    {(() => {
                      const hasUnmetPrerequisites = task.unmet_prerequisites.length > 0
                      return (
                        <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-primary-dark">{task.title}</p>
                        <p className="text-sm text-text-muted">
                          {task.client_name || 'Unknown client'} • {task.operation_template_name || 'Template'} • {task.cycle_label || 'Cycle'}
                        </p>
                        {task.due_at && <p className="text-xs text-text-muted mt-1">Due: {formatDateTime(task.due_at)}</p>}
                        {task.linked_time_entry && (
                          <p className="text-xs text-blue-700 mt-1">
                            Linked time: {task.linked_time_entry.hours.toFixed(2)}h on {formatDateTime(task.linked_time_entry.work_date)}
                            {task.linked_time_entry.user_name ? ` by ${task.linked_time_entry.user_name}` : ''}
                          </p>
                        )}
                        {hasUnmetPrerequisites && (
                          <p className="text-xs text-red-700 mt-1">
                            Waiting on: {task.unmet_prerequisites.map(dep => dep.title).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          to={`/admin/clients/${task.client_id}`}
                          className="min-h-11 inline-flex items-center text-sm text-primary hover:text-primary-dark font-medium"
                        >
                          Open Client
                        </Link>
                        <Link
                          to={`/admin/time?prefill=true&client_id=${task.client_id}&operation_task_id=${task.id}&notes=${encodeURIComponent(`Ops task: ${task.title} (${task.cycle_label || 'Cycle'})`)}`}
                          className="min-h-11 inline-flex items-center text-xs text-blue-700 hover:text-blue-800 font-medium"
                        >
                          Log Time
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {task.status !== 'in_progress' && task.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatus(task, 'in_progress')}
                          disabled={savingTaskId === task.id || hasUnmetPrerequisites}
                          className="min-h-11 px-3 py-2 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {task.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatus(task, 'done')}
                          disabled={savingTaskId === task.id || task.evidence_required || hasUnmetPrerequisites}
                          className="min-h-11 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                        >
                          Mark Done
                        </button>
                      )}
                      {task.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatus(task, 'not_started')}
                          disabled={savingTaskId === task.id}
                          className="min-h-11 px-3 py-2 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>

                    {task.evidence_required && task.status !== 'done' && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        Evidence is required before this task can be marked done from the board.
                      </p>
                    )}
                    {hasUnmetPrerequisites && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                        Complete prerequisite tasks before moving this task to in progress or done.
                      </p>
                    )}
                        </>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
