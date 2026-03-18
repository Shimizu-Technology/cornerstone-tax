import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { PortalDashboardResponse } from '../../lib/api'

export default function PortalDashboard() {
  useEffect(() => { document.title = 'Dashboard | Cornerstone Client Portal' }, [])

  const [data, setData] = useState<PortalDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await api.portalDashboard()
        if (result.data) {
          setData(result.data)
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

  const firstName = data.client.full_name.split(' ')[0]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl border border-secondary-dark p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-gray-500 mt-2">
          Here's an overview of your tax returns and any items that need your attention.
        </p>
      </div>

      {/* Action Items */}
      {data.action_items.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 px-1">Action Needed</h2>
          {data.action_items.map((item) => (
            <Link
              key={`${item.tax_return_id}-${item.type}`}
              to={`/portal/returns/${item.tax_return_id}`}
              className={`block rounded-xl p-4 border transition-all hover:shadow-md ${
                item.type === 'documents_needed'
                  ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                  : item.type === 'ready_to_sign'
                  ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                  : 'bg-green-50 border-green-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.type === 'documents_needed'
                    ? 'bg-amber-100'
                    : item.type === 'ready_to_sign'
                    ? 'bg-blue-100'
                    : 'bg-green-100'
                }`}>
                  {item.type === 'documents_needed' ? (
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  ) : item.type === 'ready_to_sign' ? (
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{item.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.tax_year} Tax Return</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tax Returns */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Your Tax Returns</h2>
          {data.tax_returns.length > 0 && (
            <Link to="/portal/returns" className="text-primary text-sm font-medium hover:underline">
              View All →
            </Link>
          )}
        </div>

        {data.tax_returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-secondary-dark p-10 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No tax returns yet</p>
            <p className="text-gray-400 text-sm mt-1">Once your intake form is processed, your return will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {data.tax_returns.map(tr => (
              <Link
                key={tr.id}
                to={`/portal/returns/${tr.id}`}
                className="bg-white rounded-xl border border-secondary-dark p-5 hover:shadow-md hover:border-primary/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-dark">{tr.tax_year}</span>
                    </div>
                    <div>
                      <span
                        className="inline-block px-3 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: tr.status_color || '#6B7280' }}
                      >
                        {tr.status}
                      </span>
                      {tr.assigned_to && (
                        <p className="text-xs text-gray-400 mt-1.5">Prepared by: {tr.assigned_to}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">{tr.documents_count} document{tr.documents_count !== 1 ? 's' : ''}</p>
                    </div>
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

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/portal/documents"
          className="bg-white rounded-xl border border-secondary-dark p-5 hover:shadow-md hover:border-primary/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">Upload Documents</h3>
              <p className="text-sm text-gray-400 mt-0.5">W-2s, 1099s, IDs, and more</p>
            </div>
          </div>
        </Link>

        <a
          href="tel:671-828-8591"
          className="bg-white rounded-xl border border-secondary-dark p-5 hover:shadow-md hover:border-primary/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">Contact Us</h3>
              <p className="text-sm text-gray-400 mt-0.5">(671) 828-8591</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}
