import { useState, useEffect, useCallback } from 'react'
import { FadeUp, StaggerContainer, StaggerItem } from '../../components/ui/MotionComponents'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatRelativeTime } from '../../lib/dateUtils'

// Define types locally to avoid Vite caching issues
interface ActivityUser {
  id: number
  name?: string
  email: string
}

interface ActivityClient {
  id: number
  name: string
}

interface ActivityTaxReturn {
  id: number
  tax_year: number
  client: ActivityClient
  current_status: string | null
}

interface WorkflowEventItem {
  id: number
  event_type: string
  description: string
  old_value: string | null
  new_value: string | null
  created_at: string
  user: ActivityUser | null
  tax_return: ActivityTaxReturn
}

interface AuditLogItem {
  id: number
  auditable_type: string
  auditable_id: number
  action: 'created' | 'updated' | 'deleted'
  description: string
  changes_made: Record<string, { from: unknown; to: unknown }> | null
  metadata: string | null
  created_at: string
  user: { id: number; email: string } | null
}

interface Pagination {
  current_page: number
  per_page: number
  total_count: number
  total_pages: number
}

interface UserSummary {
  id: number
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

// Unified activity item
type UnifiedActivityItem = 
  | { type: 'workflow'; data: WorkflowEventItem }
  | { type: 'audit'; data: AuditLogItem }

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_changed: 'Status Changed',
  assigned: 'Assignment',
  note_added: 'Note Added',
  document_uploaded: 'Document Uploaded',
  document_deleted: 'Document Deleted',
  client_notified: 'Client Notified',
  reviewed: 'Reviewed',
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  status_changed: '🔄',
  assigned: '👤',
  note_added: '📝',
  document_uploaded: '📄',
  document_deleted: '🗑️',
  client_notified: '📧',
  reviewed: '✅',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  status_changed: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-purple-100 text-purple-800 border-purple-200',
  note_added: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  document_uploaded: 'bg-green-100 text-green-800 border-green-200',
  document_deleted: 'bg-red-100 text-red-800 border-red-200',
  client_notified: 'bg-teal-100 text-teal-800 border-teal-200',
  reviewed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

// Audit log styling
const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
}

const AUDIT_ACTION_ICONS: Record<string, string> = {
  created: '➕',
  updated: '✏️',
  deleted: '🗑️',
}

const AUDIT_ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800 border-green-200',
  updated: 'bg-amber-100 text-amber-800 border-amber-200',
  deleted: 'bg-red-100 text-red-800 border-red-200',
}

const AUDITABLE_TYPE_LABELS: Record<string, string> = {
  TimeEntry: 'Time Entry',
  Client: 'Client',
  TaxReturn: 'Tax Return',
  User: 'User',
  OperationTemplate: 'Operations Template',
  OperationTemplateTask: 'Operations Template Task',
  ClientOperationAssignment: 'Operations Assignment',
  OperationCycle: 'Operations Cycle',
  OperationTask: 'Operations Task',
}

export default function Activity() {
  useEffect(() => { document.title = 'Activity | Cornerstone Admin' }, [])

  const [activities, setActivities] = useState<UnifiedActivityItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserSummary[]>([])
  
  // Filters
  type ActivitySource = 'all' | 'workflow' | 'audit'
  const [activitySource, setActivitySource] = useState<ActivitySource>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [auditTypeFilter, setAuditTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const allActivities: UnifiedActivityItem[] = []
      let workflowPagination: Pagination | null = null
      let auditPagination: Pagination | null = null

      // Fetch workflow events if needed
      if (activitySource === 'all' || activitySource === 'workflow') {
        const workflowParams = new URLSearchParams()
        // For 'all' mode, always fetch page 1 with more items; for workflow-only, paginate normally
        workflowParams.append('page', activitySource === 'all' ? '1' : currentPage.toString())
        workflowParams.append('per_page', activitySource === 'all' ? '50' : '25')
        
        if (eventTypeFilter && (activitySource as ActivitySource) !== 'audit') {
          workflowParams.append('event_type', eventTypeFilter)
        }
        if (userFilter) workflowParams.append('user_id', userFilter)
        if (startDate) workflowParams.append('start_date', startDate)
        if (endDate) workflowParams.append('end_date', endDate)
        
        const workflowResponse = await api.getWorkflowEvents(workflowParams.toString())
        if (workflowResponse.data) {
          workflowResponse.data.events.forEach(event => {
            allActivities.push({ type: 'workflow', data: event })
          })
          workflowPagination = workflowResponse.data.pagination
        }
      }

      // Fetch audit logs if needed
      if (activitySource === 'all' || activitySource === 'audit') {
        const auditResponse = await api.getAuditLogs({
          // For 'all' mode, always fetch page 1 with more items; for audit-only, paginate normally
          page: activitySource === 'all' ? 1 : currentPage,
          per_page: activitySource === 'all' ? 50 : 25,
          auditable_type: auditTypeFilter || undefined,
          user_id: userFilter ? parseInt(userFilter) : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        })
        if (auditResponse.data) {
          auditResponse.data.audit_logs.forEach(log => {
            allActivities.push({ type: 'audit', data: log })
          })
          auditPagination = auditResponse.data.pagination
        }
      }

      // Sort by created_at (newest first)
      allActivities.sort((a, b) => {
        const dateA = new Date(a.data.created_at).getTime()
        const dateB = new Date(b.data.created_at).getTime()
        return dateB - dateA
      })

      // Set activities and pagination based on source
      if (activitySource === 'all') {
        // CST-33: For 'all' mode, show combined latest items without pagination
        // (pagination across two different sources doesn't work well)
        setActivities(allActivities.slice(0, 50))
        setPagination(null) // Disable pagination for combined view
      } else if (activitySource === 'workflow') {
        setActivities(allActivities)
        setPagination(workflowPagination)
      } else {
        setActivities(allActivities)
        setPagination(auditPagination)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, activitySource, eventTypeFilter, auditTypeFilter, userFilter, startDate, endDate])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    // Fetch users for filter dropdown
    const fetchUsers = async () => {
      try {
        const response = await api.getUsers()
        if (response.data?.users) {
          setUsers(response.data.users)
        }
      } catch (error) {
        console.error('Failed to fetch users:', error)
      }
    }
    fetchUsers()
  }, [])

  // Use shared date utilities - formatRelativeTime returns { display, full }
  const getTimeDisplay = (dateString: string) => formatRelativeTime(dateString)

  // Look up display name for audit log users (CST-4)
  const getUserDisplayName = (user: { id: number; email: string } | null): string => {
    if (!user) return 'System'
    const found = users.find(u => u.id === user.id)
    if (found) {
      const name = [found.first_name, found.last_name].filter(Boolean).join(' ')
      return name || found.email
    }
    return user.email
  }

  const clearFilters = () => {
    setActivitySource('all')
    setEventTypeFilter('')
    setAuditTypeFilter('')
    setUserFilter('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  const hasFilters = activitySource !== 'all' || eventTypeFilter || auditTypeFilter || userFilter || startDate || endDate

  // Render a workflow event
  const renderWorkflowEvent = (event: WorkflowEventItem) => (
    <div className="flex items-start gap-4">
      {/* Event Icon */}
      <div className="shrink-0 hidden sm:block">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-100'}`}>
          {EVENT_TYPE_ICONS[event.event_type] || '📌'}
        </div>
      </div>

      {/* Event Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          {/* Event Type Badge - Mobile */}
          <span className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border w-fit ${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {EVENT_TYPE_ICONS[event.event_type]} {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
          </span>
          
          <p className="text-sm text-gray-900">
            <span className="font-medium">
              {event.user?.name || event.user?.email || 'System'}
            </span>
            <span className="text-gray-500 mx-1">·</span>
            <span className="text-gray-600">{event.description}</span>
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Event Type Badge - Desktop */}
          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg font-medium border ${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
          </span>

          {/* Client Link */}
          <Link
            to={`/admin/clients/${event.tax_return.client.id}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded-lg text-gray-700 hover:bg-secondary-dark transition-colors"
          >
            <span className="text-gray-400">👤</span>
            {event.tax_return.client.name}
          </Link>

          {/* Tax Year */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded-lg text-gray-600">
            <span className="text-gray-400">📅</span>
            {event.tax_return.tax_year}
          </span>

          {/* Timestamp */}
          <span 
            className="text-gray-400 ml-auto cursor-help"
            title={getTimeDisplay(event.created_at).full}
          >
            {getTimeDisplay(event.created_at).display}
          </span>
        </div>

        {/* Status Change Values */}
        {event.event_type === 'status_changed' && event.old_value && event.new_value && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg line-through">
              {event.old_value}
            </span>
            <span className="text-gray-400">→</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary font-medium rounded-lg">
              {event.new_value}
            </span>
          </div>
        )}

        {/* Assignment Change Values */}
        {event.event_type === 'assigned' && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {event.old_value && (
              <>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg line-through">
                  {event.old_value}
                </span>
                <span className="text-gray-400">→</span>
              </>
            )}
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-medium rounded-lg">
              {event.new_value || 'Unassigned'}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  // Render an audit log
  const renderAuditLog = (log: AuditLogItem) => (
    <div className="flex items-start gap-4">
      {/* Audit Icon */}
      <div className="shrink-0 hidden sm:block">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${AUDIT_ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
          {AUDIT_ACTION_ICONS[log.action] || '📋'}
        </div>
      </div>

      {/* Audit Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          {/* Action Badge - Mobile */}
          <span className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border w-fit ${AUDIT_ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {AUDIT_ACTION_ICONS[log.action]} {AUDITABLE_TYPE_LABELS[log.auditable_type] || log.auditable_type} {AUDIT_ACTION_LABELS[log.action]}
          </span>
          
          <p className="text-sm text-gray-900">
            <span className="font-medium">
              {getUserDisplayName(log.user)}
            </span>
            <span className="text-gray-500 mx-1">·</span>
            <span className="text-gray-600">{log.description}</span>
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Action Badge - Desktop */}
          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg font-medium border ${AUDIT_ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {AUDIT_ACTION_LABELS[log.action]}
          </span>

          {/* Entity Type */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded-lg text-gray-700">
            <span className="text-gray-400">⏱️</span>
            {AUDITABLE_TYPE_LABELS[log.auditable_type] || log.auditable_type}
          </span>

          {/* Metadata (e.g., hours on date) */}
          {log.metadata && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded-lg text-gray-600">
              {log.metadata}
            </span>
          )}

          {/* Timestamp */}
          <span 
            className="text-gray-400 ml-auto cursor-help"
            title={getTimeDisplay(log.created_at).full}
          >
            {getTimeDisplay(log.created_at).display}
          </span>
        </div>

        {/* Changes for updates */}
        {log.action === 'updated' && log.changes_made && Object.keys(log.changes_made).length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {Object.entries(log.changes_made).map(([field, change]) => {
              // Handle case where change is an object with from/to
              const hasFromTo = change && typeof change === 'object' && 'from' in change && 'to' in change
              
              if (hasFromTo) {
                return (
                  <div key={field} className="flex items-center gap-1">
                    <span className="text-gray-500 capitalize">{field.replace(/_/g, ' ')}:</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg line-through">
                      {String(change.from ?? 'none')}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 font-medium rounded-lg">
                      {String(change.to ?? 'none')}
                    </span>
                  </div>
                )
              } else {
                // Handle case where change is just a value (e.g., income_source_added: "payer name")
                return (
                  <div key={field} className="flex items-center gap-1">
                    <span className="text-gray-500 capitalize">{field.replace(/_/g, ' ')}:</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 font-medium rounded-lg">
                      {String(change)}
                    </span>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeUp>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark tracking-tight">Activity</h1>
          <p className="text-gray-600 mt-1">Track all workflow events and changes</p>
        </div>
        {pagination && (
          <div className="text-sm text-gray-500">
            {activities.length} activities shown
          </div>
        )}
      </div>
      </FadeUp>

      {/* Filters */}
      <FadeUp delay={0.05}>
      <div className="bg-white rounded-2xl border border-secondary-dark p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Filters</h2>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary hover:text-primary-dark transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Activity Source Filter */}
          <div>
            <label htmlFor="activity-type-filter" className="block text-xs font-medium text-gray-500 mb-1">
              Activity Type
            </label>
            <select
              id="activity-type-filter"
              value={activitySource}
              onChange={(e) => {
                setActivitySource(e.target.value as 'all' | 'workflow' | 'audit')
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Activity</option>
              <option value="workflow">Workflow Events</option>
              <option value="audit">Audit Logs</option>
            </select>
          </div>

          {/* Event Type Filter (only for workflow) */}
          <div>
            <label htmlFor="event-type-filter" className="block text-xs font-medium text-gray-500 mb-1">
              Event Type
            </label>
            <select
              id="event-type-filter"
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              disabled={activitySource === 'audit'}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">All types</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Type Filter (only for audit source) */}
          <div>
            <label htmlFor="audit-type-filter" className="block text-xs font-medium text-gray-500 mb-1">
              Audit Type
            </label>
            <select
              id="audit-type-filter"
              value={auditTypeFilter}
              onChange={(e) => {
                setAuditTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              disabled={activitySource === 'workflow'}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">All audit types</option>
              {Object.entries(AUDITABLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label htmlFor="user-filter" className="block text-xs font-medium text-gray-500 mb-1">
              User
            </label>
            <select
              id="user-filter"
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All users</option>
              {/* CST-36: Use first name instead of email */}
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 bg-secondary border border-secondary-dark rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>
      </FadeUp>

      {/* Activity Feed */}
      <FadeUp delay={0.1}>
      <div className="bg-white rounded-2xl border border-secondary-dark overflow-hidden hover:shadow-md transition-shadow duration-300">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-500">No activity found</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-primary hover:text-primary-dark"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <StaggerContainer className="divide-y divide-secondary-dark">
            {activities.map((activity) => (
              <StaggerItem key={`${activity.type}-${activity.data.id}`}><div
                className="p-4 sm:p-5 hover:bg-secondary/30 transition-colors"
              >
                {activity.type === 'workflow' 
                  ? renderWorkflowEvent(activity.data as WorkflowEventItem)
                  : renderAuditLog(activity.data as AuditLogItem)
                }
              </div></StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="border-t border-secondary-dark px-4 py-3 flex items-center justify-between bg-secondary/30">
            <div className="text-sm text-gray-500">
              Page {pagination.current_page} of {pagination.total_pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-secondary-dark bg-white text-gray-700 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={currentPage === pagination.total_pages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-secondary-dark bg-white text-gray-700 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </FadeUp>
    </div>
  )
}
