import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { PortalTaxReturnSummary } from '../../lib/api'

export default function PortalReturns() {
  useEffect(() => { document.title = 'My Returns | Cornerstone Client Portal' }, [])

  const [returns, setReturns] = useState<PortalTaxReturnSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await api.portalTaxReturns()
        if (result.data) {
          setReturns(result.data.tax_returns)
        } else if (result.error) {
          setError(result.error)
        }
      } catch {
        setError('Failed to load tax returns')
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-800 font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-red-600 underline text-sm">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Tax Returns</h1>
        <p className="text-gray-500 mt-1">View the status of all your tax returns.</p>
      </div>

      {returns.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-dark p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No tax returns yet</p>
          <p className="text-gray-400 text-sm mt-1">Once your intake form is processed, your returns will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {returns.map(tr => (
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
                    <p className="text-xs text-gray-300 mt-0.5">
                      Updated {new Date(tr.updated_at).toLocaleDateString()}
                    </p>
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
  )
}
