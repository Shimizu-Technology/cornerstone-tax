import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import type { DailyTask, UserSummary } from '../../lib/api'

// ── Toast Notification ──

type ToastType = 'success' | 'error'

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, type === 'error' ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, type])

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in ${
      type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
    }`}>
      {type === 'error' ? (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

// ── Helpers ──

const getGuamDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Guam',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const formatDateLong = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const formatShortDate = (isoStr: string | null) => {
  if (!isoStr) return '—'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Guam',
    month: 'numeric', day: 'numeric', year: '2-digit',
  }).formatToParts(new Date(isoStr))
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  const year = parts.find(p => p.type === 'year')!.value
  return `${month}/${day}/${year}`
}

const shiftDate = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return getGuamDateString(date)
}

const isToday = (dateStr: string): boolean => dateStr === getGuamDateString()

type TaskStatus = 'not_started' | 'in_progress' | 'dms_reviewing' | 'ready_to_file' | 'ready_for_signature' | 'completed' | 'filed_with_drt' | 'filed_with_irs' | 'pending_info' | 'other' | 'done'

const DONE_STATUSES: TaskStatus[] = ['completed', 'filed_with_drt', 'filed_with_irs', 'done']

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: '1 - Not Started' },
  { value: 'in_progress', label: '2 - In Progress' },
  { value: 'dms_reviewing', label: '3 - DMS Reviewing' },
  { value: 'ready_to_file', label: '4 - Ready to File' },
  { value: 'ready_for_signature', label: '5 - Ready for Signature' },
  { value: 'completed', label: '6 - Completed' },
  { value: 'filed_with_drt', label: '7 - Filed with DRT' },
  { value: 'filed_with_irs', label: '8 - Filed with IRS' },
  { value: 'pending_info', label: '9 - Pending Info' },
  { value: 'other', label: '10 - Other' },
]

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: '1 - Not Started', color: 'text-gray-700', bg: 'bg-gray-100' },
  in_progress: { label: '2 - In Progress', color: 'text-blue-700', bg: 'bg-blue-50' },
  dms_reviewing: { label: '3 - DMS Reviewing', color: 'text-purple-700', bg: 'bg-purple-50' },
  ready_to_file: { label: '4 - Ready to File', color: 'text-amber-700', bg: 'bg-amber-50' },
  ready_for_signature: { label: '5 - Ready for Signature', color: 'text-orange-700', bg: 'bg-orange-50' },
  completed: { label: '6 - Completed', color: 'text-green-700', bg: 'bg-green-50' },
  filed_with_drt: { label: '7 - Filed w/ DRT', color: 'text-green-800', bg: 'bg-green-100' },
  filed_with_irs: { label: '8 - Filed w/ IRS', color: 'text-green-800', bg: 'bg-green-100' },
  pending_info: { label: '9 - Pending Info', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  other: { label: '10 - Other', color: 'text-gray-500', bg: 'bg-gray-50' },
  done: { label: 'Done', color: 'text-green-700', bg: 'bg-green-50' },
}

// ── Inline Editable Cell ──

function EditableCell({ value, onSave, placeholder, multiline, className }: {
  value: string
  onSave: (val: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setDraft(value) }, [value])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    const cls = "w-full text-sm border border-primary rounded px-2 py-1 focus:ring-2 focus:ring-primary focus:outline-none"
    return multiline ? (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        rows={3}
        className={`${cls} resize-none`}
      />
    ) : (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className={cls}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-sm text-left w-full hover:text-primary transition-colors ${className || 'text-gray-700'}`}
      title={value || placeholder}
    >
      {value || <span className="text-gray-300 italic">{placeholder || '—'}</span>}
    </button>
  )
}

// ── Add Task Row ──

function AddTaskRow({ taskDate, staff, onAdd, showToast }: {
  taskDate: string
  staff: UserSummary[]
  onAdd: (task: DailyTask) => void
  showToast: (msg: string, type?: ToastType) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [formService, setFormService] = useState('')
  const [comments, setComments] = useState('')
  const [assignedToId, setAssignedToId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (isAdding) inputRef.current?.focus() }, [isAdding])

  const reset = () => {
    setTitle(''); setFormService(''); setComments(''); setAssignedToId(null)
    setIsAdding(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await api.createDailyTask({
        title: title.trim(),
        task_date: taskDate,
        form_service: formService.trim() || undefined,
        comments: comments.trim() || undefined,
        assigned_to_id: assignedToId,
      })
      if (res.data?.daily_task) { onAdd(res.data.daily_task); reset() }
      else showToast(res.error || 'Failed to create task')
    } finally { setSaving(false) }
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-primary hover:bg-gray-50/80 transition-colors border-t border-gray-100 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add task...
      </button>
    )
  }

  return (
    <div className="border-t border-gray-100 bg-blue-50/30 px-4 py-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Client name..." className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary"
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') reset() }} />
        <input value={formService} onChange={e => setFormService(e.target.value)}
          placeholder="Form / Service" className="sm:w-40 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary"
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') reset() }} />
        <select value={assignedToId ?? ''} onChange={e => setAssignedToId(e.target.value ? Number(e.target.value) : null)}
          className="sm:w-36 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary">
          <option value="">Staff...</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <input value={comments} onChange={e => setComments(e.target.value)}
        placeholder="Comments (optional)" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary"
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') reset() }} />
      <div className="flex gap-2 justify-end">
        <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim() || saving}
          className="text-sm bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ── Desktop Task Row (spreadsheet-style) ──

function TaskRow({ task, staff, onUpdate, onDelete, showToast, onSaving, dragHandlers, isDragTarget }: {
  task: DailyTask
  staff: UserSummary[]
  onUpdate: (t: DailyTask) => void
  onDelete: (id: number) => void
  showToast: (msg: string, type?: ToastType) => void
  onSaving: (saving: boolean) => void
  dragHandlers: {
    onDragStart: (e: React.DragEvent, id: number) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent, id: number) => void
    onDragEnd: () => void
  }
  isDragTarget: boolean
}) {
  const [deleting, setDeleting] = useState(false)
  const isDone = DONE_STATUSES.includes(task.status)

  const save = async (field: string, value: unknown) => {
    onSaving(true)
    try {
      const res = await api.updateDailyTask(task.id, { [field]: value ?? null } as Record<string, unknown>)
      if (res.data?.daily_task) onUpdate(res.data.daily_task)
      else showToast(res.error || 'Failed to save change')
    } finally {
      setTimeout(() => onSaving(false), 2000)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    setDeleting(true)
    onSaving(true)
    const res = await api.deleteDailyTask(task.id)
    if (!res.error) onDelete(task.id)
    else { showToast(res.error || 'Failed to delete task'); setDeleting(false) }
    setTimeout(() => onSaving(false), 2000)
  }

  const statusCfg = STATUS_DISPLAY[task.status] || STATUS_DISPLAY.not_started

  return (
    <tr
      className={`group border-b border-gray-100 transition-colors hover:bg-gray-50/50 ${isDone ? 'opacity-50' : ''} ${isDragTarget ? 'bg-blue-50! border-t-2 border-t-primary!' : ''}`}
      draggable
      onDragStart={e => dragHandlers.onDragStart(e, task.id)}
      onDragOver={dragHandlers.onDragOver}
      onDrop={e => dragHandlers.onDrop(e, task.id)}
      onDragEnd={dragHandlers.onDragEnd}
    >
      {/* # drag handle */}
      <td className="px-1 py-2 w-8 text-center">
        <div className="cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-gray-500 inline-flex">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
            <circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/>
            <circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/>
          </svg>
        </div>
      </td>

      {/* Client (title) — free text */}
      <td className="px-2 py-2" style={{ minWidth: 180 }}>
        <EditableCell
          value={task.title}
          onSave={v => save('title', v)}
          placeholder="Client name..."
          className={isDone ? 'line-through text-gray-400' : 'text-gray-900 font-medium'}
        />
      </td>

      {/* Form/Service — free text */}
      <td className="px-2 py-2" style={{ minWidth: 160 }}>
        <EditableCell value={task.form_service || ''} onSave={v => save('form_service', v)} placeholder="Form / Service" />
      </td>

      {/* Comments — free text, multiline */}
      <td className="px-2 py-2" style={{ minWidth: 260 }}>
        <EditableCell value={task.comments || ''} onSave={v => save('comments', v)} placeholder="Add comment..." multiline className="text-gray-600 whitespace-pre-wrap" />
      </td>

      {/* Staff */}
      <td className="px-2 py-2" style={{ minWidth: 100 }}>
        <select value={task.assigned_to?.id ?? ''} onChange={e => save('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
          className="text-sm bg-transparent border-0 cursor-pointer hover:text-primary focus:ring-0 p-0 w-full text-gray-700">
          <option value="">—</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
      </td>

      {/* Reviewed By */}
      <td className="px-2 py-2" style={{ minWidth: 100 }}>
        <select value={task.reviewed_by?.id ?? ''} onChange={e => save('reviewed_by_id', e.target.value ? Number(e.target.value) : null)}
          className="text-sm bg-transparent border-0 cursor-pointer hover:text-primary focus:ring-0 p-0 w-full text-gray-700">
          <option value="">—</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
      </td>

      {/* Status */}
      <td className="px-2 py-2" style={{ minWidth: 170 }}>
        <select value={task.status} onChange={e => save('status', e.target.value)}
          className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-primary w-full ${statusCfg.bg} ${statusCfg.color}`}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>

      {/* Date (auto from status_changed_at) */}
      <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap" style={{ minWidth: 75 }}>
        {formatShortDate(task.status_changed_at)}
      </td>

      {/* Status Entered By (auto, read-only) */}
      <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap" style={{ minWidth: 80 }}>
        {task.status_changed_by?.name || '—'}
      </td>

      {/* Actions */}
      <td className="px-1 py-2 w-8">
        <button onClick={handleDelete} disabled={deleting}
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-0.5" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

// ── Mobile Task Card ──

function TaskCard({ task, staff, onUpdate, onDelete, showToast, onSaving }: {
  task: DailyTask; staff: UserSummary[]
  onUpdate: (t: DailyTask) => void; onDelete: (id: number) => void
  showToast: (msg: string, type?: ToastType) => void
  onSaving: (saving: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isDone = DONE_STATUSES.includes(task.status)
  const statusCfg = STATUS_DISPLAY[task.status] || STATUS_DISPLAY.not_started

  const save = async (field: string, value: unknown) => {
    onSaving(true)
    try {
      const res = await api.updateDailyTask(task.id, { [field]: value ?? null } as Record<string, unknown>)
      if (res.data?.daily_task) onUpdate(res.data.daily_task)
      else showToast(res.error || 'Failed to save change')
    } finally {
      setTimeout(() => onSaving(false), 2000)
    }
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${isDone ? 'opacity-50' : ''}`}>
      <div className="px-4 py-3 flex items-start gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            {task.form_service && <span className="font-medium">{task.form_service}</span>}
            {task.assigned_to && <span>Staff: {task.assigned_to.name}</span>}
            <span className={`${statusCfg.color} font-medium`}>{statusCfg.label}</span>
          </div>
          {task.comments && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.comments}</p>}
        </div>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-3">
          <div>
            <label className="text-xs text-gray-400 font-medium">Client</label>
            <EditableCell value={task.title} onSave={v => save('title', v)} placeholder="Client name..." className="text-gray-900 font-medium mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium">Form/Service</label>
            <EditableCell value={task.form_service || ''} onSave={v => save('form_service', v)} placeholder="Form / Service" className="mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium">Comments</label>
            <EditableCell value={task.comments || ''} onSave={v => save('comments', v)} placeholder="Add comment..." multiline className="text-gray-600 mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium">Status</label>
            <select value={task.status} onChange={e => save('status', e.target.value)}
              className={`w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 ${statusCfg.color}`}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 font-medium">Staff</label>
              <select value={task.assigned_to?.id ?? ''} onChange={e => save('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="">—</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium">Reviewed By</label>
              <select value={task.reviewed_by?.id ?? ''} onChange={e => save('reviewed_by_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="">—</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          </div>
          {task.status_changed_by && (
            <p className="text-xs text-gray-400">
              Status set by {task.status_changed_by.name} {task.status_changed_at && `on ${formatShortDate(task.status_changed_at)}`}
            </p>
          )}
          <div className="flex justify-end">
            <button onClick={async () => { if (!confirm('Delete?')) return; setDeleting(true); const r = await api.deleteDailyTask(task.id); if (!r.error) onDelete(task.id); else { showToast(r.error || 'Failed to delete task'); setDeleting(false) } }}
              disabled={deleting} className="text-xs text-red-500 hover:text-red-700">{deleting ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats Bar ──

function StatsSummary({ tasks }: { tasks: DailyTask[] }) {
  const total = tasks.length
  const done = tasks.filter(t => DONE_STATUSES.includes(t.status)).length
  const active = tasks.filter(t => !DONE_STATUSES.includes(t.status) && t.status !== 'not_started').length
  const todo = tasks.filter(t => t.status === 'not_started').length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-gray-600 font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
        <span>{done} done</span><span className="text-gray-300">|</span>
        <span>{active} active</span><span className="text-gray-300">|</span>
        <span>{todo} to do</span>
      </div>
    </div>
  )
}

// ── Main Page ──

export default function DailyTaskBoard() {
  useEffect(() => { document.title = 'Daily Tasks | Cornerstone Admin' }, [])

  const [currentDate, setCurrentDate] = useState(getGuamDateString())
  const [allTasks, setAllTasks] = useState<DailyTask[]>([])
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [staff, setStaff] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(true)
  const [filterStaff, setFilterStaff] = useState<number | ''>('')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all')
  const [dragTargetId, setDragTargetId] = useState<number | null>(null)
  const [copyingTasks, setCopyingTasks] = useState(false)
  const [showCopyPicker, setShowCopyPicker] = useState(false)
  const [copyTargetDate, setCopyTargetDate] = useState(shiftDate(currentDate, 1))
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savingRef = useRef(false)

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    Promise.all([api.getUsers(), api.getCurrentUser()])
      .then(([u, me]) => {
        if (u.data?.users) setStaff(u.data.users.filter((x: UserSummary) => x.role === 'admin' || x.role === 'employee'))
        if (me.data?.user) setCurrentUserId(me.data.user.id)
      })
  }, [])

  const loadTasks = useCallback(async (silent = false) => {
    if (silent && savingRef.current) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await api.getDailyTasks({ task_date: currentDate, include_done: true })
      if (!savingRef.current && res.data?.daily_tasks) setAllTasks(res.data.daily_tasks)
      else if (res.error) setError(res.error)
    } catch { setError('Failed to load tasks') }
    finally { if (!silent) setLoading(false) }
  }, [currentDate])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    pollRef.current = setInterval(() => loadTasks(true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadTasks])

  useEffect(() => {
    let f = [...allTasks]
    if (!showDone) f = f.filter(t => !DONE_STATUSES.includes(t.status))
    if (filterStaff) f = f.filter(t => t.assigned_to?.id === filterStaff)
    if (filterStatus) f = f.filter(t => t.status === filterStatus)
    if (viewMode === 'my' && currentUserId) f = f.filter(t => t.assigned_to?.id === currentUserId)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      f = f.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.form_service && t.form_service.toLowerCase().includes(q)) ||
        (t.comments && t.comments.toLowerCase().includes(q)) ||
        (t.assigned_to?.name && t.assigned_to.name.toLowerCase().includes(q)) ||
        (t.reviewed_by?.name && t.reviewed_by.name.toLowerCase().includes(q))
      )
    }
    setTasks(f)
  }, [allTasks, showDone, filterStaff, filterStatus, searchQuery, viewMode, currentUserId])

  // Drag & drop
  const dragSrc = useRef<number | null>(null)
  const onDragStart = (_e: React.DragEvent, id: number) => { dragSrc.current = id }
  const onDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault(); setDragTargetId(null)
    const srcId = dragSrc.current
    if (!srcId || srcId === targetId) return
    const arr = [...allTasks]
    const si = arr.findIndex(t => t.id === srcId)
    const ti = arr.findIndex(t => t.id === targetId)
    if (si === -1 || ti === -1) return
    const [moved] = arr.splice(si, 1)
    arr.splice(ti, 0, moved)
    const reordered = arr.map((t, i) => ({ ...t, position: i }))
    setAllTasks(reordered)
    savingRef.current = true
    try {
      const res = await api.reorderDailyTasks(reordered.map((t, i) => ({ id: t.id, position: i })))
      if (res.error) { showToast('Failed to save new order — will refresh'); loadTasks(true) }
    } finally {
      setTimeout(() => { savingRef.current = false }, 2000)
    }
  }
  const onDragEnd = () => { dragSrc.current = null; setDragTargetId(null) }

  const handleAdded = (t: DailyTask) => setAllTasks(p => [...p, t])
  const handleUpdated = (u: DailyTask) => {
    setAllTasks(p => p.map(t => t.id === u.id ? u : t))
  }
  const handleDeleted = (id: number) => {
    setAllTasks(p => p.filter(t => t.id !== id))
  }
  const handleSaving = (saving: boolean) => { savingRef.current = saving }

  const copyToDate = async () => {
    const target = copyTargetDate
    const targetLabel = formatDate(target)
    const toCopy = allTasks.filter(t => !DONE_STATUSES.includes(t.status))

    setCopyingTasks(true)
    try {
      const check = await api.getDailyTasks({ task_date: target, include_done: true })
      const existingCount = check.data?.daily_tasks?.length ?? 0

      if (existingCount > 0) {
        const proceed = confirm(
          `${targetLabel} already has ${existingCount} task${existingCount !== 1 ? 's' : ''}.\n\n` +
          `Copying will add ${toCopy.length} more task${toCopy.length !== 1 ? 's' : ''} (not replace existing ones).\n\n` +
          `Continue?`
        )
        if (!proceed) { setCopyingTasks(false); return }
      }

      const res = await api.copyDailyTasksToDate(currentDate, target)
      if (res.data?.copied_count) {
        showToast(`Copied ${res.data.copied_count} task(s) to ${targetLabel}`, 'success')
        setShowCopyPicker(false)
      } else if (res.error) showToast(res.error || 'Failed to copy tasks')
    } finally { setCopyingTasks(false) }
  }

  const exportToCSV = () => {
    const escape = (val: string) => {
      if (!val) return ''
      if (val.includes(',') || val.includes('"') || val.includes('\n'))
        return `"${val.replace(/"/g, '""')}"`
      return val
    }
    const headers = ['#', 'Client', 'Form/Service', 'Comments', 'Staff', 'Reviewed By', 'Status', 'Date', 'Status By']
    const rows = tasks.map((t, i) => [
      String(i + 1),
      escape(t.title),
      escape(t.form_service ?? ''),
      escape(t.comments ?? ''),
      escape(t.assigned_to?.name ?? ''),
      escape(t.reviewed_by?.name ?? ''),
      escape(STATUS_DISPLAY[t.status]?.label ?? t.status),
      escape(formatShortDate(t.status_changed_at ?? null)),
      escape(t.status_changed_by?.name ?? ''),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-tasks-${currentDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const dateLabel = formatDateLong(currentDate)
    const total = tasks.length
    const done = tasks.filter(t => DONE_STATUSES.includes(t.status)).length

    const tableRows = tasks.map((t, i) => {
      const statusLabel = STATUS_DISPLAY[t.status]?.label ?? t.status
      return `<tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="font-weight:600">${esc(t.title)}</td>
        <td>${esc(t.form_service ?? '')}</td>
        <td style="font-size:8.5pt;color:#444">${esc(t.comments ?? '')}</td>
        <td>${esc(t.assigned_to?.name ?? '')}</td>
        <td>${esc(t.reviewed_by?.name ?? '')}</td>
        <td>${esc(statusLabel)}</td>
        <td style="font-size:8.5pt">${formatShortDate(t.status_changed_at ?? null)}</td>
        <td style="font-size:8.5pt">${esc(t.status_changed_by?.name ?? '')}</td>
      </tr>`
    }).join('')

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Daily Tasks — ${dateLabel}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 0.3in; color: #222; }
        h1 { font-size: 14pt; margin-bottom: 2pt; }
        .meta { font-size: 9pt; color: #666; margin-bottom: 10pt; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.3pt; padding: 4pt 5pt; text-align: left; border-bottom: 1.5pt solid #d1d5db; }
        td { padding: 4pt 5pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
        tr:nth-child(even) td { background: #fafafa; }
        .footer { margin-top: 12pt; font-size: 7.5pt; color: #aaa; text-align: center; }
        @page { margin: 0.3in; size: letter landscape; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Cornerstone — Daily Tasks</h1>
      <div class="meta">${dateLabel} &nbsp;·&nbsp; ${total} task${total !== 1 ? 's' : ''} &nbsp;·&nbsp; ${done} completed</div>
      <table>
        <thead><tr>
          <th style="width:28px">#</th><th>Client</th><th>Form/Service</th><th>Comments</th>
          <th>Staff</th><th>Reviewed By</th><th>Status</th><th>Date</th><th>Status By</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">Printed ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} — Cornerstone Accounting & Business Services</div>
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
      </body></html>`)
    printWindow.document.close()
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage your team's daily workflow</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={exportToCSV}
            disabled={tasks.length === 0}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          <button onClick={handlePrint}
            disabled={tasks.length === 0}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <div className="relative">
            <button onClick={() => { setCopyTargetDate(shiftDate(currentDate, 1)); setShowCopyPicker(!showCopyPicker) }}
              disabled={copyingTasks || allTasks.filter(t => !DONE_STATUSES.includes(t.status)).length === 0}
              className="text-sm px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              {copyingTasks ? 'Copying...' : 'Copy to...'}
            </button>
            {showCopyPicker && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-30 w-72">
                <div className="text-sm font-medium text-gray-700 mb-2">Copy {allTasks.filter(t => !DONE_STATUSES.includes(t.status)).length} open task(s) to:</div>
                <input type="date" value={copyTargetDate} onChange={e => setCopyTargetDate(e.target.value)}
                  min={shiftDate(currentDate, 1)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-primary focus:border-primary" />
                {copyTargetDate && copyTargetDate !== currentDate && (
                  <div className="text-xs text-gray-500 mb-3">{formatDateLong(copyTargetDate)}</div>
                )}
                <div className="flex gap-2">
                  <button onClick={copyToDate} disabled={!copyTargetDate || copyTargetDate === currentDate || copyingTasks}
                    className="flex-1 text-sm bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
                    {copyingTasks ? 'Copying...' : 'Copy'}
                  </button>
                  <button onClick={() => setShowCopyPicker(false)}
                    className="text-sm px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Nav */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(p => shiftDate(p, -1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Previous day">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center px-3">
            <div className="text-lg font-semibold text-gray-900">{formatDateLong(currentDate)}</div>
            {isToday(currentDate) && <span className="text-xs text-primary font-medium">Today</span>}
          </div>
          <button onClick={() => setCurrentDate(p => shiftDate(p, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="Next day">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          {!isToday(currentDate) && (
            <button onClick={() => setCurrentDate(getGuamDateString())} className="ml-2 text-sm text-primary hover:text-primary/80 font-medium">Today</button>
          )}
        </div>
        <StatsSummary tasks={allTasks} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setViewMode('all')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>All Tasks</button>
          <button onClick={() => setViewMode('my')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'my' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>My Tasks</button>
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 bg-white text-gray-600 placeholder:text-gray-400 w-44 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value ? Number(e.target.value) : '')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600">
          <option value="">All Staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | '')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
          Show completed
        </label>
        {(filterStaff || filterStatus || searchQuery || !showDone || viewMode === 'my') && (
          <button onClick={() => { setFilterStaff(''); setFilterStatus(''); setSearchQuery(''); setShowDone(true); setViewMode('all') }}
            className="text-xs text-primary hover:text-primary/80 font-medium ml-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => loadTasks()} className="text-sm text-red-600 hover:text-red-800 font-medium">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading tasks...</p>
        </div>
      )}

      {/* ═══ DESKTOP TABLE (scrollable, spreadsheet-style) ═══ */}
      {!loading && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="w-8 px-1 py-2.5" />
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 180 }}>Client</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 160 }}>Form/Service</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 260 }}>Comments</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 100 }}>Staff</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 100 }}>Reviewed By</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 170 }}>Status</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 75 }}>Date</th>
                  <th className="px-2 py-2.5 text-left" style={{ minWidth: 80 }}>Status By</th>
                  <th className="w-8 px-1 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <TaskRow key={task.id} task={task} staff={staff}
                    onUpdate={handleUpdated} onDelete={handleDeleted} showToast={showToast} onSaving={handleSaving}
                    dragHandlers={{ onDragStart, onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragTargetId(task.id) }, onDrop, onDragEnd }}
                    isDragTarget={dragTargetId === task.id} />
                ))}
              </tbody>
            </table>
          </div>
          {tasks.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No tasks for this day. Add one below!</div>}
          <AddTaskRow taskDate={currentDate} staff={staff} onAdd={handleAdded} showToast={showToast} />
        </div>
      )}

      {/* ═══ MOBILE CARDS ═══ */}
      {!loading && (
        <div className="md:hidden space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} staff={staff} onUpdate={handleUpdated} onDelete={handleDeleted} showToast={showToast} onSaving={handleSaving} />
          ))}
          {tasks.length === 0 && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">No tasks for this day.</div>}
          <AddTaskRow taskDate={currentDate} staff={staff} onAdd={handleAdded} showToast={showToast} />
        </div>
      )}
    </div>
  )
}
