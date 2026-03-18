import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { PortalTaxReturnDetail, PortalDocument } from '../../lib/api'
import { formatFileSize } from '../../lib/formatUtils'
import DocumentViewer from '../../components/common/DocumentViewer'

export default function PortalReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const [taxReturn, setTaxReturn] = useState<PortalTaxReturnDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<PortalDocument | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const result = await api.portalTaxReturn(parseInt(id, 10))
        if (result.data) {
          setTaxReturn(result.data.tax_return)
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

  const fetchViewUrl = useCallback(async () => {
    if (!viewingDoc || !taxReturn) return null
    const result = await api.portalGetDocumentDownloadUrl(taxReturn.id, viewingDoc.id)
    return result.data?.download_url || null
  }, [viewingDoc, taxReturn])

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
        <Link to="/portal/returns" className="mt-3 text-red-600 underline text-sm inline-block">
          Back to My Returns
        </Link>
      </div>
    )
  }

  const { workflow_progress } = taxReturn

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/portal/returns" className="text-gray-400 hover:text-gray-600 text-sm inline-flex items-center gap-1 transition-colors mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Returns
        </Link>
        <div className="bg-white rounded-2xl border border-secondary-dark p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-primary-dark">{taxReturn.tax_year}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {taxReturn.tax_year} Tax Return
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: taxReturn.status_color || '#6B7280' }}
                >
                  {taxReturn.status}
                </span>
                {taxReturn.assigned_to && (
                  <span className="text-sm text-gray-400">Prepared by {taxReturn.assigned_to}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tracker */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-6">Progress</h2>

        {/* Desktop step tracker */}
        <div className="hidden sm:block">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
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
                        ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/25'
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
                  <p className={`text-xs text-center mt-2 max-w-[90px] leading-tight ${
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
        <div className="sm:hidden space-y-0">
          {workflow_progress.stages.map((stage, i) => (
            <div key={stage.slug} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
                    stage.current
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/25'
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
                  <div className={`w-0.5 h-6 ${stage.completed ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </div>
              <p className={`text-sm pt-1.5 ${
                stage.current ? 'font-semibold text-primary-dark' : stage.completed ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {stage.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout for income sources and documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Sources */}
        {taxReturn.income_sources.length > 0 && (
          <div className="bg-white rounded-xl border border-secondary-dark p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Income Sources</h2>
            <div className="space-y-2">
              {taxReturn.income_sources.map(is => (
                <div key={is.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs bg-secondary text-primary-dark px-2.5 py-1 rounded-md font-semibold uppercase tracking-wide">
                    {is.source_type.replaceAll('_', ' ')}
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
              className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1"
            >
              Upload
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>

          {taxReturn.documents.length === 0 ? (
            <div className="py-6 text-center">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-sm">No documents yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {taxReturn.documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                  onClick={() => setViewingDoc(doc)}
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    {doc.content_type?.startsWith('image/') ? (
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400">
                      {doc.document_type?.replaceAll('_', ' ') || 'Other'} · {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DocumentViewer
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        filename={viewingDoc?.filename || ''}
        contentType={viewingDoc?.content_type || null}
        onFetchUrl={fetchViewUrl}
      />
    </div>
  )
}
