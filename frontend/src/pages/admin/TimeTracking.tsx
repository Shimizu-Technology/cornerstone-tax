import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'

// Local types to avoid Vite caching issues
interface TimeCategory {
  id: number
  name: string
  description: string | null
}

interface TimeEntryItem {
  id: number
  work_date: string
  start_time: string | null
  end_time: string | null
  formatted_start_time: string | null
  formatted_end_time: string | null
  hours: number
  break_minutes: number | null
  description: string | null
  user: {
    id: number
    email: string
    display_name?: string
    full_name?: string
  }
  time_category: {
    id: number
    name: string
  } | null
  client: {
    id: number
    name: string
  } | null
  tax_return: {
    id: number
    tax_year: number
  } | null
  created_at: string
  updated_at: string
}

// Break duration presets
const BREAK_PRESETS = [
  { label: 'None', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: 'Custom', minutes: -1 }, // -1 indicates custom
]

interface ClientOption {
  id: number
  first_name: string
  last_name: string
}

interface UserOption {
  id: number
  email: string
  display_name?: string
  full_name?: string
  role: string
}

// Icons
const PlusIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const ClockIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const ChartIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

// Helper functions
function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  const day = start.getDay()
  start.setDate(start.getDate() - day) // Start on Sunday
  
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

export default function TimeTracking() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState<TimeEntryItem[]>([])
  const [categories, setCategories] = useState<TimeCategory[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tab: 'entries' or 'reports'
  const [activeTab, setActiveTab] = useState<'entries' | 'reports'>('entries')
  
  // View mode: 'day' or 'week'
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Entries filters (for Time Entries tab)
  const [entryFilters, setEntryFilters] = useState({
    user_id: '',
    time_category_id: '',
    client_id: '',
  })
  
  // Report filters
  const [reportFilters, setReportFilters] = useState({
    start_date: formatDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), // First of month
    end_date: formatDateISO(new Date()),
    user_id: '',
    time_category_id: '',
  })
  const [reportData, setReportData] = useState<TimeEntryItem[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportSummary, setReportSummary] = useState({ total_hours: 0, total_break_hours: 0, entry_count: 0 })
  
  // Summary
  const [totalHours, setTotalHours] = useState(0)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntryItem | null>(null)
  const [formData, setFormData] = useState({
    work_date: formatDateISO(new Date()),
    start_time: '08:00',
    end_time: '17:00',
    description: '',
    time_category_id: '',
    client_id: '',
    break_minutes: null as number | null
  })
  const [saving, setSaving] = useState(false)

  // Calculate hours from start/end times and break
  const calculateHours = (start: string, end: string, breakMins: number | null): number => {
    if (!start || !end) return 0
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    let durationMinutes = endMinutes - startMinutes
    if (durationMinutes < 0) durationMinutes += 24 * 60 // Handle overnight
    if (breakMins) durationMinutes -= breakMins
    return Math.max(0, durationMinutes / 60)
  }

  const calculatedHours = calculateHours(formData.start_time, formData.end_time, formData.break_minutes)

  // Load time entries
  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: Record<string, string | number> = {}
      
      if (viewMode === 'day') {
        params.date = formatDateISO(currentDate)
      } else {
        // Get week start (Sunday)
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDate.getDay())
        params.week = formatDateISO(weekStart)
      }

      // Apply filters
      if (entryFilters.user_id) {
        params.user_id = parseInt(entryFilters.user_id)
      }
      if (entryFilters.time_category_id) {
        params.time_category_id = parseInt(entryFilters.time_category_id)
      }
      if (entryFilters.client_id) {
        params.client_id = parseInt(entryFilters.client_id)
      }

      const response = await api.getTimeEntries(params as unknown as Parameters<typeof api.getTimeEntries>[0])
      
      if (response.data) {
        setEntries(response.data.time_entries as unknown as TimeEntryItem[])
        setTotalHours(response.data.summary.total_hours)
      } else {
        setError(response.error || 'Failed to load time entries')
      }
    } catch {
      setError('Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [currentDate, viewMode, entryFilters])

  // Load categories, clients, and users
  const loadOptions = useCallback(async () => {
    try {
      const [catResponse, clientResponse, userResponse, currentUserResponse] = await Promise.all([
        api.getTimeCategories(),
        api.getClients({ per_page: 100 }),
        api.getUsers(),
        api.getCurrentUser()
      ])

      if (catResponse.data) {
        setCategories(catResponse.data.time_categories as unknown as TimeCategory[])
      }

      if (clientResponse.data) {
        setClients(clientResponse.data.clients.map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name
        })))
      }

      if (userResponse.data) {
        setUsers(userResponse.data.users.map(u => ({
          id: u.id,
          email: u.email,
          display_name: u.display_name,
          full_name: u.full_name,
          role: u.role
        })))
      }

      if (currentUserResponse.data) {
        setIsAdmin(currentUserResponse.data.user.is_admin)
      }
    } catch {
      console.error('Failed to load options')
    }
  }, [])
  
  // Load report data
  const loadReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const params: Record<string, string | number> = {
        start_date: reportFilters.start_date,
        end_date: reportFilters.end_date,
        per_page: 1000, // Get all for reports
      }
      
      if (reportFilters.user_id) {
        params.user_id = parseInt(reportFilters.user_id)
      }
      if (reportFilters.time_category_id) {
        params.time_category_id = parseInt(reportFilters.time_category_id)
      }

      const response = await api.getTimeEntries(params as unknown as Parameters<typeof api.getTimeEntries>[0])
      
      if (response.data) {
        setReportData(response.data.time_entries as unknown as TimeEntryItem[])
        setReportSummary({
          total_hours: response.data.summary.total_hours,
          total_break_hours: response.data.summary.total_break_hours || 0,
          entry_count: response.data.summary.entry_count
        })
      }
    } catch {
      console.error('Failed to load report')
    } finally {
      setReportLoading(false)
    }
  }, [reportFilters])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])
  
  useEffect(() => {
    if (activeTab === 'reports') {
      loadReport()
    }
  }, [activeTab, loadReport])

  // Handle prefill from schedule
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill === 'true') {
      const date = searchParams.get('date') || formatDateISO(new Date())
      const startTime = searchParams.get('start_time') || '08:00'
      const endTime = searchParams.get('end_time') || '17:00'
      const notes = searchParams.get('notes') || ''
      
      // Open modal with pre-filled data
      setEditingEntry(null)
      setFormData({
        work_date: date,
        start_time: startTime,
        end_time: endTime,
        description: notes,
        time_category_id: '',
        client_id: '',
        break_minutes: null
      })
      setShowModal(true)
      
      // Clear the URL params
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // Navigation
  const goToToday = () => setCurrentDate(new Date())
  
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  // Modal handlers
  const openNewEntry = (date?: Date, prefillStart?: string, prefillEnd?: string, prefillNotes?: string) => {
    setEditingEntry(null)
    setFormData({
      work_date: formatDateISO(date || currentDate),
      start_time: prefillStart || '08:00',
      end_time: prefillEnd || '17:00',
      description: prefillNotes || '',
      time_category_id: '',
      client_id: '',
      break_minutes: null
    })
    setShowModal(true)
  }

  const openEditEntry = (entry: TimeEntryItem) => {
    setEditingEntry(entry)
    setFormData({
      work_date: entry.work_date,
      start_time: entry.start_time || '08:00',
      end_time: entry.end_time || '17:00',
      description: entry.description || '',
      time_category_id: entry.time_category?.id.toString() || '',
      client_id: entry.client?.id.toString() || '',
      break_minutes: entry.break_minutes
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const data = {
        work_date: formData.work_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        description: formData.description || undefined,
        time_category_id: formData.time_category_id ? parseInt(formData.time_category_id) : undefined,
        client_id: formData.client_id ? parseInt(formData.client_id) : undefined,
        break_minutes: formData.break_minutes
      }

      if (editingEntry) {
        const response = await api.updateTimeEntry(editingEntry.id, data)
        if (response.error) {
          setError(response.error)
          return
        }
      } else {
        const response = await api.createTimeEntry(data)
        if (response.error) {
          setError(response.error)
          return
        }
      }

      setShowModal(false)
      loadEntries()
    } catch {
      setError('Failed to save time entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entry: TimeEntryItem) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    try {
      const response = await api.deleteTimeEntry(entry.id)
      if (response.error) {
        setError(response.error)
        return
      }
      loadEntries()
    } catch {
      setError('Failed to delete time entry')
    }
  }

  // Get week dates for week view
  const weekDates = getWeekDates(currentDate)

  // Group entries by date for week view
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.work_date
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {} as Record<string, TimeEntryItem[]>)

  // Calculate hours per day
  const hoursPerDay = weekDates.reduce((acc, date) => {
    const dateStr = formatDateISO(date)
    const dayEntries = entriesByDate[dateStr] || []
    acc[dateStr] = dayEntries.reduce((sum, e) => sum + e.hours, 0)
    return acc
  }, {} as Record<string, number>)

  // Calculate report summaries by category and user
  const reportByCategory = reportData.reduce((acc, entry) => {
    const catName = entry.time_category?.name || 'Uncategorized'
    if (!acc[catName]) acc[catName] = 0
    acc[catName] += entry.hours
    return acc
  }, {} as Record<string, number>)

  const reportByUser = reportData.reduce((acc, entry) => {
    const name = entry.user.display_name || entry.user.email.split('@')[0]
    if (!acc[name]) acc[name] = 0
    acc[name] += entry.hours
    return acc
  }, {} as Record<string, number>)

  const reportByClient = reportData.reduce((acc, entry) => {
    const clientName = entry.client?.name || 'No Client'
    if (!acc[clientName]) acc[clientName] = 0
    acc[clientName] += entry.hours
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Time Tracking</h1>
          <p className="text-text-muted mt-1">Track your hours by category and client</p>
        </div>
        {activeTab === 'entries' && (
          <button
            onClick={() => openNewEntry()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors min-h-[44px]"
          >
            <PlusIcon />
            <span>Log Time</span>
          </button>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-neutral-warm">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('entries')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'entries'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            <ClockIcon />
            Time Entries
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'reports'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary-dark'
              }`}
            >
              <ChartIcon />
              Reports
            </button>
          )}
        </nav>
      </div>

      {/* Entries Tab */}
      {activeTab === 'entries' && (
      <>
      {/* Filters (Admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Employee</label>
              <select
                value={entryFilters.user_id}
                onChange={(e) => setEntryFilters({ ...entryFilters, user_id: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Employees</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.display_name || user.email.split('@')[0]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Category</label>
              <select
                value={entryFilters.time_category_id}
                onChange={(e) => setEntryFilters({ ...entryFilters, time_category_id: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Client</label>
              <select
                value={entryFilters.client_id}
                onChange={(e) => setEntryFilters({ ...entryFilters, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Clear filters button */}
          {(entryFilters.user_id || entryFilters.time_category_id || entryFilters.client_id) && (
            <button
              onClick={() => setEntryFilters({ user_id: '', time_category_id: '', client_id: '' })}
              className="mt-3 text-sm text-primary hover:text-primary-dark font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* View Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-4 sm:hidden">
          {/* Top row: Date range and total */}
          <div className="text-center">
            <div className="font-semibold text-primary-dark">
              {viewMode === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </div>
            <div className="text-sm text-primary-dark">
              Total: <span className="font-semibold text-primary">{totalHours.toFixed(1)} hours</span>
            </div>
          </div>
          {/* Bottom row: Toggle + Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg overflow-hidden border border-neutral-warm">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'day'
                    ? 'bg-primary text-white'
                    : 'bg-white text-primary-dark'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-primary text-white'
                    : 'bg-white text-primary-dark'
                }`}
              >
                Week
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevious}
                className="p-2 text-primary-dark hover:bg-neutral-warm rounded-lg"
              >
                <ChevronLeftIcon />
              </button>
              <button
                onClick={goToToday}
                className={`px-2 py-1 text-sm font-medium rounded-lg ${
                  isSameDay(currentDate, new Date())
                    ? 'bg-primary text-white'
                    : 'text-primary-dark hover:bg-neutral-warm'
                }`}
              >
                Today
              </button>
              <button
                onClick={goToNext}
                className="p-2 text-primary-dark hover:bg-neutral-warm rounded-lg"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:grid grid-cols-3 items-center gap-4">
          {/* View Mode Toggle - Left */}
          <div className="flex rounded-lg overflow-hidden border border-neutral-warm w-fit">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-primary text-white'
                  : 'bg-white text-primary-dark hover:bg-neutral-warm'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-primary text-white'
                  : 'bg-white text-primary-dark hover:bg-neutral-warm'
              }`}
            >
              Week
            </button>
          </div>

          {/* Date Navigation - Center */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 text-primary-dark hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={goToToday}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isSameDay(currentDate, new Date())
                  ? 'bg-primary text-white'
                  : 'text-primary-dark hover:text-primary hover:bg-neutral-warm'
              }`}
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="p-2 text-primary-dark hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Current Date Display - Right */}
          <div className="text-right">
            <div className="font-semibold text-primary-dark">
              {viewMode === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </div>
            <div className="text-sm text-primary-dark">
              Total: <span className="font-semibold text-primary">{totalHours.toFixed(1)} hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-text-muted">Loading time entries...</span>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* Week View */
        <div className="bg-white rounded-lg shadow-sm border border-neutral-warm overflow-hidden">
          <div className="overflow-x-auto">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-neutral-warm min-w-[600px]">
              {weekDates.map((date, idx) => {
                const dateStr = formatDateISO(date)
                const isToday = isSameDay(date, new Date())
                const dayHours = hoursPerDay[dateStr] || 0
                
                return (
                  <div
                    key={idx}
                    className={`p-2 sm:p-3 text-center border-r border-neutral-warm last:border-r-0 ${
                      isToday ? 'bg-primary/20 border-b-2 border-b-primary' : ''
                    }`}
                  >
                    <div className={`text-xs font-semibold uppercase ${isToday ? 'text-primary' : 'text-primary-dark'}`}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-base sm:text-lg font-bold ${isToday ? 'text-primary' : 'text-primary-dark'}`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-xs font-semibold ${isToday ? 'text-primary' : (dayHours > 0 ? 'text-primary' : 'text-primary-dark')}`}>
                      {dayHours.toFixed(1)}h
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Week Entries */}
            <div className="grid grid-cols-7 min-h-[250px] sm:min-h-[300px] min-w-[600px]">
              {weekDates.map((date, idx) => {
                const dateStr = formatDateISO(date)
                const dayEntries = entriesByDate[dateStr] || []
                const isToday = isSameDay(date, new Date())
                
                return (
                  <div
                    key={idx}
                    className={`border-r border-neutral-warm last:border-r-0 p-1 sm:p-2 ${
                      isToday ? 'bg-primary/10' : ''
                    }`}
                  >
                    {dayEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="mb-1 sm:mb-2 p-1 sm:p-2 bg-white border border-neutral-warm rounded text-xs cursor-pointer hover:bg-neutral-warm/50 transition-colors shadow-sm"
                        onClick={() => openEditEntry(entry)}
                      >
                        <div className="font-bold text-primary-dark flex items-center gap-1">
                          <ClockIcon />
                          {entry.hours}h
                        </div>
                        {entry.formatted_start_time && entry.formatted_end_time && (
                          <div className="text-primary-dark/70 text-[10px]">
                            {entry.formatted_start_time} - {entry.formatted_end_time}
                          </div>
                        )}
                        {entry.time_category && (
                          <div className="text-primary font-medium truncate text-[10px] sm:text-xs">{entry.time_category.name}</div>
                        )}
                        {isAdmin && (
                          <div className="text-primary-dark/70 truncate text-[10px] mt-0.5 sm:mt-1 hidden sm:block">{entry.user.display_name || entry.user.email.split('@')[0]}</div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => openNewEntry(date)}
                      className="w-full p-1 sm:p-2 text-xs text-primary-dark font-medium hover:text-primary hover:bg-neutral-warm rounded transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Day View */
        <div className="bg-white rounded-lg shadow-sm border border-neutral-warm">
          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 text-primary-dark">
                <ClockIcon />
              </div>
              <p className="text-primary-dark font-medium">No time entries for this day</p>
              <button
                onClick={() => openNewEntry()}
                className="mt-4 text-primary hover:text-primary-dark font-semibold"
              >
                Log your first entry
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-warm">
              {entries.map(entry => (
                <div key={entry.id} className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Hours + Time + Category Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-primary/20 text-primary font-bold rounded-full text-sm">
                          <ClockIcon />
                          {entry.hours}h
                        </span>
                        {entry.formatted_start_time && entry.formatted_end_time && (
                          <span className="text-xs sm:text-sm text-primary-dark/70">
                            {entry.formatted_start_time} - {entry.formatted_end_time}
                          </span>
                        )}
                        {entry.time_category && (
                          <span className="px-2 py-1 bg-primary/10 text-primary font-medium text-xs sm:text-sm rounded">
                            {entry.time_category.name}
                          </span>
                        )}
                      </div>
                      {/* User (only show for admin) */}
                      {isAdmin && (
                        <p className="mt-1 text-xs sm:text-sm text-primary-dark/80 truncate">
                          by {entry.user.display_name || entry.user.email.split('@')[0]}
                        </p>
                      )}
                      {/* Description */}
                      {entry.description && (
                        <p className="mt-2 text-primary-dark text-sm">{entry.description}</p>
                      )}
                      {/* Client */}
                      {entry.client && (
                        <p className="mt-1 text-primary-dark/70 text-xs sm:text-sm">
                          Client: {entry.client.name}
                          {entry.tax_return && ` (${entry.tax_return.tax_year})`}
                        </p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditEntry(entry)}
                        className="p-2 text-primary-dark hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-2 text-primary-dark hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entry Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-primary-dark mb-4">
                {editingEntry ? 'Edit Time Entry' : 'Log Time'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                {/* Calculated Hours Display */}
                <div className="bg-neutral-warm/30 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-primary-dark">Calculated Hours:</span>
                  <span className="text-lg font-bold text-primary">{calculatedHours.toFixed(2)}h</span>
                </div>

                {/* Break Duration */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Break Duration
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {BREAK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (preset.minutes === -1) {
                            // Custom - keep current value or set to empty for custom input
                            setFormData({ ...formData, break_minutes: formData.break_minutes || 0 })
                          } else {
                            setFormData({ ...formData, break_minutes: preset.minutes })
                          }
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          (preset.minutes === null && formData.break_minutes === null) ||
                          (preset.minutes === formData.break_minutes) ||
                          (preset.minutes === -1 && formData.break_minutes !== null && !BREAK_PRESETS.slice(0, -1).some(p => p.minutes === formData.break_minutes))
                            ? 'bg-primary text-white'
                            : 'bg-neutral-warm text-primary-dark hover:bg-primary/20'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Custom input - show when a value is set that's not a preset, or when Custom is selected */}
                  {formData.break_minutes !== null && !BREAK_PRESETS.slice(0, -1).some(p => p.minutes === formData.break_minutes) && (
                    <input
                      type="number"
                      min="0"
                      max="480"
                      value={formData.break_minutes || ''}
                      onChange={(e) => setFormData({ ...formData, break_minutes: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Minutes"
                      className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  )}
                  <p className="text-xs text-text-muted mt-1">Break time is not counted toward work hours</p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Category
                  </label>
                  <select
                    value={formData.time_category_id}
                    onChange={(e) => setFormData({ ...formData, time_category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select category...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Client */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Client (optional)
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">No client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.first_name} {client.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="What did you work on?"
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-primary-dark font-medium hover:bg-neutral-warm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingEntry ? 'Update' : 'Save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && isAdmin && (
        <div className="space-y-6">
          {/* Report Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
            <h3 className="text-sm font-medium text-primary-dark mb-4">Filter Report</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Start Date</label>
                <input
                  type="date"
                  value={reportFilters.start_date}
                  onChange={(e) => setReportFilters({ ...reportFilters, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">End Date</label>
                <input
                  type="date"
                  value={reportFilters.end_date}
                  onChange={(e) => setReportFilters({ ...reportFilters, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm text-text-muted mb-1">Employee</label>
                  <select
                    value={reportFilters.user_id}
                    onChange={(e) => setReportFilters({ ...reportFilters, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">All Employees</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.display_name || user.email.split('@')[0]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-text-muted mb-1">Category</label>
                <select
                  value={reportFilters.time_category_id}
                  onChange={(e) => setReportFilters({ ...reportFilters, time_category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-warm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
              <div className="text-sm text-text-muted">Work Hours</div>
              <div className="text-3xl font-bold text-primary mt-1">
                {reportLoading ? '...' : reportSummary.total_hours.toFixed(1)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
              <div className="text-sm text-text-muted">Break Hours</div>
              <div className="text-3xl font-bold text-text-muted mt-1">
                {reportLoading ? '...' : reportSummary.total_break_hours.toFixed(1)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
              <div className="text-sm text-text-muted">Total Entries</div>
              <div className="text-3xl font-bold text-primary-dark mt-1">
                {reportLoading ? '...' : reportSummary.entry_count}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm p-4">
              <div className="text-sm text-text-muted">Avg Hours/Entry</div>
              <div className="text-3xl font-bold text-text-muted mt-1">
                {reportLoading ? '...' : (reportSummary.entry_count > 0 ? (reportSummary.total_hours / reportSummary.entry_count).toFixed(1) : '0')}
              </div>
            </div>
          </div>

          {/* Summary Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Category */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-warm bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark">Hours by Category</h3>
              </div>
              <div className="divide-y divide-neutral-warm">
                {reportLoading ? (
                  <div className="p-4 text-center text-text-muted">Loading...</div>
                ) : Object.entries(reportByCategory).length === 0 ? (
                  <div className="p-4 text-center text-text-muted">No data</div>
                ) : (
                  Object.entries(reportByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, hours]) => (
                      <div key={name} className="px-4 py-3 flex justify-between items-center">
                        <span className="text-primary-dark">{name}</span>
                        <span className="font-semibold text-primary">{hours.toFixed(1)}h</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* By Employee */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-warm bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark">Hours by Employee</h3>
              </div>
              <div className="divide-y divide-neutral-warm">
                {reportLoading ? (
                  <div className="p-4 text-center text-text-muted">Loading...</div>
                ) : Object.entries(reportByUser).length === 0 ? (
                  <div className="p-4 text-center text-text-muted">No data</div>
                ) : (
                  Object.entries(reportByUser)
                    .sort((a, b) => b[1] - a[1])
                    .map(([email, hours]) => (
                      <div key={email} className="px-4 py-3 flex justify-between items-center">
                        <span className="text-primary-dark truncate max-w-[150px]">{email}</span>
                        <span className="font-semibold text-primary">{hours.toFixed(1)}h</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* By Client */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-warm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-warm bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark">Hours by Client</h3>
              </div>
              <div className="divide-y divide-neutral-warm max-h-[300px] overflow-y-auto">
                {reportLoading ? (
                  <div className="p-4 text-center text-text-muted">Loading...</div>
                ) : Object.entries(reportByClient).length === 0 ? (
                  <div className="p-4 text-center text-text-muted">No data</div>
                ) : (
                  Object.entries(reportByClient)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, hours]) => (
                      <div key={name} className="px-4 py-3 flex justify-between items-center">
                        <span className="text-primary-dark truncate max-w-[150px]">{name}</span>
                        <span className="font-semibold text-primary">{hours.toFixed(1)}h</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Detailed Entries Table */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-warm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-warm bg-neutral-warm/30">
              <h3 className="font-semibold text-primary-dark">Detailed Entries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-warm/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Date</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Employee</th>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Client</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-warm">
                  {reportLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-muted">Loading...</td>
                    </tr>
                  ) : reportData.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-muted">No entries found</td>
                    </tr>
                  ) : (
                    reportData.slice(0, 100).map(entry => (
                      <tr key={entry.id} className="hover:bg-neutral-warm/20">
                        <td className="px-4 py-3 text-sm text-primary-dark whitespace-nowrap">{formatDate(entry.work_date)}</td>
                        {isAdmin && <td className="px-4 py-3 text-sm text-text-muted truncate max-w-[150px]">{entry.user.display_name || entry.user.email.split('@')[0]}</td>}
                        <td className="px-4 py-3 text-sm text-primary-dark whitespace-nowrap">
                          {entry.formatted_start_time && entry.formatted_end_time 
                            ? `${entry.formatted_start_time} - ${entry.formatted_end_time}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted">{entry.time_category?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-text-muted truncate max-w-[150px]">{entry.client?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-primary font-semibold text-right">{entry.hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-text-muted truncate max-w-[200px]">{entry.description || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {reportData.length > 100 && (
                <div className="px-4 py-3 text-center text-sm text-text-muted border-t border-neutral-warm">
                  Showing first 100 entries of {reportData.length} total
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
