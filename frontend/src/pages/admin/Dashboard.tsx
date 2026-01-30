import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Schedule, TimeEntry } from '../../lib/api'
import QuickCreateClientModal from '../../components/admin/QuickCreateClientModal'
import { SkeletonStats, SkeletonCard, SkeletonTimeEntry } from '../../components/ui/Skeleton'
import { FadeIn } from '../../components/ui/FadeIn'

interface DashboardStats {
  totalClients: number
  activeReturns: number
  pendingReview: number
  readyForPickup: number
}

interface RecentClient {
  id: number
  full_name: string
  email: string
  created_at: string
  tax_return: {
    status: string
    status_color: string
  } | null
}

// Group time entries by user for the activity widget
interface UserActivity {
  userId: number
  displayName: string
  totalHours: number
  totalBreakMinutes: number
  entries: TimeEntry[]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeReturns: 0,
    pendingReview: 0,
    readyForPickup: 0,
  })
  const [recentClients, setRecentClients] = useState<RecentClient[]>([])
  const [mySchedule, setMySchedule] = useState<Schedule[]>([])
  const [teamActivity, setTeamActivity] = useState<UserActivity[]>([])
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load team activity for a given date
  const loadTeamActivity = async (date: string) => {
    setActivityLoading(true)
    try {
      const result = await api.getTimeEntries({ date })
      if (result.data) {
        // Group entries by user
        const userMap = new Map<number, UserActivity>()
        
        for (const entry of result.data.time_entries) {
          const userId = entry.user.id
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              userId,
              displayName: entry.user.display_name || entry.user.email.split('@')[0],
              totalHours: 0,
              totalBreakMinutes: 0,
              entries: []
            })
          }
          const userActivity = userMap.get(userId)!
          userActivity.totalHours += entry.hours
          userActivity.totalBreakMinutes += entry.break_minutes || 0
          userActivity.entries.push(entry)
        }
        
        // Sort by total hours descending
        const activities = Array.from(userMap.values()).sort((a, b) => b.totalHours - a.totalHours)
        setTeamActivity(activities)
      }
    } catch (error) {
      console.error('Failed to load team activity:', error)
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [clientsResult, scheduleResult] = await Promise.all([
          api.getClients({ per_page: 5 }),
          api.getMySchedule(),
        ])
        
        if (clientsResult.data) {
          setRecentClients(clientsResult.data.clients)
          setStats({
            totalClients: clientsResult.data.meta.total_count,
            activeReturns: clientsResult.data.meta.total_count,
            pendingReview: 0,
            readyForPickup: 0,
          })
        }
        
        if (scheduleResult.data) {
          setMySchedule(scheduleResult.data.schedules)
        }

        // Load today's activity
        await loadTeamActivity(new Date().toISOString().split('T')[0])
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-12 w-32 bg-gray-200 rounded-xl animate-pulse" />
        </div>
        
        {/* Stats skeleton */}
        <SkeletonStats />
        
        {/* Team Activity skeleton */}
        <div className="bg-white rounded-2xl border border-secondary-dark overflow-hidden">
          <div className="px-6 py-5 border-b border-secondary-dark">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-secondary-dark">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonTimeEntry key={i} />
            ))}
          </div>
        </div>
        
        {/* Schedule skeleton */}
        <SkeletonCard />
        
        {/* Recent clients skeleton */}
        <SkeletonCard />
      </div>
    )
  }

  return (
    <FadeIn>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Client
        </button>
      </div>

      <QuickCreateClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(clientId) => {
          navigate(`/admin/clients/${clientId}`)
        }}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Clients"
          value={stats.totalClients}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          gradient="from-primary to-primary-dark"
        />
        <StatCard
          title="Active Returns"
          value={stats.activeReturns}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="In Review"
          value={stats.pendingReview}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
          gradient="from-amber-500 to-amber-600"
        />
        <StatCard
          title="Ready for Pickup"
          value={stats.readyForPickup}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
          gradient="from-teal-500 to-teal-600"
        />
      </div>

      {/* Team Activity Widget */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark overflow-hidden">
        <div className="px-6 py-5 border-b border-secondary-dark">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Team Activity</h2>
                <p className="text-sm text-gray-500">What everyone's working on</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const yesterday = new Date()
                  yesterday.setDate(yesterday.getDate() - 1)
                  const dateStr = yesterday.toISOString().split('T')[0]
                  setActivityDate(dateStr)
                  loadTeamActivity(dateStr)
                }}
                className="p-2 text-gray-500 hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                title="Previous day"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setActivityDate(today)
                  loadTeamActivity(today)
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activityDate === new Date().toISOString().split('T')[0]
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-secondary'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  const dateStr = tomorrow.toISOString().split('T')[0]
                  setActivityDate(dateStr)
                  loadTeamActivity(dateStr)
                }}
                className="p-2 text-gray-500 hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                title="Next day"
                disabled={activityDate >= new Date().toISOString().split('T')[0]}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {activityDate !== new Date().toISOString().split('T')[0] && (
            <p className="text-sm text-primary mt-2 font-medium">
              {new Date(activityDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          )}
        </div>
        <div className="divide-y divide-secondary-dark">
          {activityLoading ? (
            <div className="px-6 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">Loading activity...</p>
            </div>
          ) : teamActivity.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500">No time logged for this day</p>
              <Link to="/admin/time" className="text-primary text-sm font-medium hover:underline mt-1 inline-block">
                Log time now →
              </Link>
            </div>
          ) : (
            teamActivity.map((activity) => (
              <div key={activity.userId} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-light to-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {activity.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-gray-900">{activity.displayName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">
                          {activity.totalHours.toFixed(1)}h
                        </span>
                        {activity.totalBreakMinutes > 0 && (
                          <span className="text-xs text-gray-500">
                            ({activity.totalBreakMinutes}m break)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {activity.entries.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 flex-shrink-0">
                            {entry.formatted_start_time} - {entry.formatted_end_time}
                          </span>
                          <span className="text-gray-600 truncate">
                            {entry.time_category?.name || 'General'}
                            {entry.description && (
                              <span className="text-gray-500"> — {entry.description}</span>
                            )}
                            {entry.client && (
                              <span className="text-primary-dark"> • {entry.client.name}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {teamActivity.length > 0 && (
          <div className="px-6 py-3 bg-secondary/30 border-t border-secondary-dark">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                <strong>{teamActivity.length}</strong> {teamActivity.length === 1 ? 'person' : 'people'} logged time
              </span>
              <Link
                to="/admin/time"
                className="text-primary hover:text-primary-dark text-sm font-medium inline-flex items-center gap-1"
              >
                View All Time
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* My Schedule */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark overflow-hidden">
        <div className="px-6 py-5 border-b border-secondary-dark flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">My Upcoming Shifts</h2>
          <Link
            to="/admin/schedule"
            className="text-primary hover:text-primary-dark text-sm font-medium inline-flex items-center gap-1 transition-colors"
          >
            View Full Schedule
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="divide-y divide-secondary-dark">
          {mySchedule.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No upcoming shifts scheduled</p>
            </div>
          ) : (
            mySchedule.slice(0, 5).map((schedule) => (
              <div key={schedule.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(schedule.work_date + 'T00:00:00').toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {schedule.formatted_time_range}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {schedule.hours.toFixed(1)}h
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Clients */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark overflow-hidden">
        <div className="px-6 py-5 border-b border-secondary-dark flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Clients</h2>
          <Link
            to="/admin/clients"
            className="text-primary hover:text-primary-dark text-sm font-medium inline-flex items-center gap-1 transition-colors"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="divide-y divide-secondary-dark">
          {recentClients.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">No clients yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-primary hover:text-primary-dark font-medium"
              >
                Create your first client →
              </button>
            </div>
          ) : (
            recentClients.map((client) => (
              <Link
                key={client.id}
                to={`/admin/clients/${client.id}`}
                className="block px-6 py-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-primary-light to-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold">
                      {client.full_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{client.full_name}</p>
                        <p className="text-sm text-gray-500 truncate">{client.email}</p>
                      </div>
                      {client.tax_return && (
                        <span
                          className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-sm"
                          style={{ backgroundColor: client.tax_return.status_color || '#8B7355' }}
                        >
                          {client.tax_return.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
    </FadeIn>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  gradient: string
}

function StatCard({ title, value, icon, gradient }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark p-5 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`bg-gradient-to-br ${gradient} text-white p-3 rounded-xl shadow-md`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </div>
    </div>
  )
}
