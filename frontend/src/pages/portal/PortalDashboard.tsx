import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

interface DashboardData {
  client: {
    id: number
    full_name: string
    email: string
    phone: string
  }
  tax_returns: Array<{
    id: number
    tax_year: number
    status: string
    status_slug: string
    status_color: string
    assigned_to: string | null
    documents_count: number
    created_at: string
    updated_at: string
  }>
  action_items: Array<{
    type: string
    message: string
    tax_return_id: number
    tax_year: number
  }>
}

export default function PortalDashboard() {
  useEffect(() => { document.title = 'Dashboard | Cornerstone Client Portal' }, [])

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await api.portalDashboard()
        if (result.data) {
          setData(result.data as unknown as DashboardData)
        } else if (result.error) {
          setError(result.error)
        }
      } catch {
        setError('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-800 font-medium">{error || 'Something went wrong'}</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-red-600 underline text-sm">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Welcome, {data.client.full_name.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">Here's an overview of your tax returns.</p>
      </div>

      {/* Action Items */}
      {data.action_items.length > 0 && (
        <div className="space-y-3">
          {data.action_items.map((item, i) => (
            <Link
              key={i}
              to={`/portal/returns/${item.tax_return_id}`}
              className={`block rounded-xl p-4 border transition-all hover:shadow-md ${
                item.type === 'documents_needed'
                  ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                  : item.type === 'ready_to_sign'
                  ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                  : 'bg-green-50 border-green-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.type === 'documents_needed'
                    ? 'bg-amber-100'
                    : item.type === 'ready_to_sign'
                    ? 'bg-blue-100'
                    : 'bg-green-100'
                }`}>
                  {item.type === 'documents_needed' ? (
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Click to view details →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tax Returns */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Your Tax Returns</h2>

        {data.tax_returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-secondary-dark p-8 text-center">
            <p className="text-gray-500">No tax returns found.</p>
            <p className="text-gray-400 text-sm mt-1">Once your intake form is processed, your return will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {data.tax_returns.map(tr => (
              <Link
                key={tr.id}
                to={`/portal/returns/${tr.id}`}
                className="bg-white rounded-xl border border-secondary-dark p-5 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-primary-dark">{tr.tax_year}</div>
                    <div>
                      <span
                        className="inline-block px-3 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: tr.status_color || '#6B7280' }}
                      >
                        {tr.status}
                      </span>
                      {tr.assigned_to && (
                        <p className="text-xs text-gray-400 mt-1">Prepared by: {tr.assigned_to}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{tr.documents_count} doc{tr.documents_count !== 1 ? 's' : ''}</span>
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
        <p className="text-gray-500 text-sm leading-relaxed">
          Contact Cornerstone Accounting at{' '}
          <a href="tel:671-727-8242" className="text-primary font-medium hover:underline">671-727-8242</a>
          {' '}or email{' '}
          <a href="mailto:dafne@cornerstoneaccounting.tax" className="text-primary font-medium hover:underline">dafne@cornerstoneaccounting.tax</a>
        </p>
      </div>
    </div>
  )
}
