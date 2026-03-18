import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'

interface WorkflowStage {
  name: string
  slug: string
  position: number
  color: string
  completed: boolean
  current: boolean
}

interface TaxReturnDetail {
  id: number
  tax_year: number
  status: string
  status_slug: string
  status_color: string
  assigned_to: string | null
  income_sources: Array<{ id: number; source_type: string; payer_name: string }>
  documents: Array<{
    id: number
    filename: string
    document_type: string
    file_size: number
    created_at: string
  }>
  workflow_progress: {
    current_stage: string
    current_position: number
    stages: WorkflowStage[]
  }
  created_at: string
  updated_at: string
}

export default function PortalReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const [taxReturn, setTaxReturn] = useState<TaxReturnDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const result = await api.portalTaxReturn(parseInt(id))
        if (result.data) {
          setTaxReturn((result.data as { tax_return: TaxReturnDetail }).tax_return)
        } else if (result.error) {
          setError(result.error)
        }
      } catch {
        setError('Failed to load tax return')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (taxReturn) {
      document.title = `${taxReturn.tax_year} Tax Return | Cornerstone Client Portal`
    }
  }, [taxReturn])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !taxReturn) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-800 font-medium">{error || 'Tax return not found'}</p>
        <Link to="/portal" className="mt-3 text-red-600 underline text-sm inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const { workflow_progress } = taxReturn

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/portal" className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block transition-colors">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {taxReturn.tax_year} Tax Return
          </h1>
          <span
            className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: taxReturn.status_color || '#6B7280' }}
          >
            {taxReturn.status}
          </span>
        </div>
        {taxReturn.assigned_to && (
          <p className="text-gray-500 text-sm mt-1">Prepared by: {taxReturn.assigned_to}</p>
        )}
      </div>

      {/* Status Tracker */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Progress</h2>

        {/* Desktop step tracker */}
        <div className="hidden sm:block">
          <div className="relative">
            {/* Background line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
            {/* Progress line */}
            <div
              className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
              style={{
                width: `${Math.max(0, ((workflow_progress.current_position - 1) / Math.max(workflow_progress.stages.length - 1, 1)) * 100)}%`
              }}
            />

            <div className="relative flex justify-between">
              {workflow_progress.stages.map((stage) => (
                <div key={stage.slug} className="flex flex-col items-center" style={{ width: `${100 / workflow_progress.stages.length}%` }}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      stage.current
                        ? 'bg-primary border-primary text-white scale-110 shadow-md'
                        : stage.completed
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {stage.completed ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{stage.position}</span>
                    )}
                  </div>
                  <p className={`text-xs text-center mt-2 max-w-[80px] leading-tight ${
                    stage.current ? 'font-semibold text-primary-dark' : stage.completed ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {stage.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile step tracker (vertical) */}
        <div className="sm:hidden space-y-3">
          {workflow_progress.stages.map((stage, i) => (
            <div key={stage.slug} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    stage.current
                      ? 'bg-primary border-primary text-white'
                      : stage.completed
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {stage.completed ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{stage.position}</span>
                  )}
                </div>
                {i < workflow_progress.stages.length - 1 && (
                  <div className={`w-0.5 h-4 ${stage.completed ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </div>
              <p className={`text-sm ${
                stage.current ? 'font-semibold text-primary-dark' : stage.completed ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {stage.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Income Sources */}
      {taxReturn.income_sources.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-dark p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Income Sources</h2>
          <div className="space-y-2">
            {taxReturn.income_sources.map(is => (
              <div key={is.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium uppercase">
                  {is.source_type.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-900">{is.payer_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Documents ({taxReturn.documents.length})</h2>
          <Link
            to="/portal/documents"
            className="text-primary text-sm font-medium hover:underline"
          >
            Upload Documents →
          </Link>
        </div>

        {taxReturn.documents.length === 0 ? (
          <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {taxReturn.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400">
                      {doc.document_type?.replace('_', ' ') || 'Other'} · {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
