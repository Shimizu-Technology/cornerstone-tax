import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Schedule } from '../../lib/api'
import QuickCreateClientModal from '../../components/admin/QuickCreateClientModal'

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
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
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
