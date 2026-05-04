import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import type { PortalTaxReturnSummary, PortalDocument } from '../../lib/api'
import { formatFileSize } from '../../lib/formatUtils'
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPES,
  MAX_FILE_SIZE,
  getDocumentContentType,
  inferDocumentType,
  isAllowedDocumentFile,
} from '../../lib/documentConstants'
import DocumentViewer from '../../components/common/DocumentViewer'

type QueuedPortalDocument = {
  id: string
  file: File
  documentType: string
}

const uploadSourceClasses = (source?: 'client' | 'staff') => (
  source === 'staff'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
)

export default function PortalDocuments() {
  useEffect(() => { document.title = 'Documents | Cornerstone Client Portal' }, [])

  const [taxReturns, setTaxReturns] = useState<PortalTaxReturnSummary[]>([])
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [queuedDocuments, setQueuedDocuments] = useState<QueuedPortalDocument[]>([])
  const [viewingDoc, setViewingDoc] = useState<PortalDocument | null>(null)
  const viewingReturnIdRef = useRef<number | null>(null)
  const activeReturnRef = useRef<number | null>(null)

  const openDocViewer = useCallback((doc: PortalDocument) => {
    viewingReturnIdRef.current = selectedReturnId
    setViewingDoc(doc)
  }, [selectedReturnId])

  const closeViewer = useCallback(() => setViewingDoc(null), [])

  useEffect(() => {
    async function loadReturns() {
      try {
        const result = await api.portalTaxReturns()
        if (result.data) {
          const returns = result.data.tax_returns
          setTaxReturns(returns)
          if (returns.length > 0) setSelectedReturnId(returns[0].id)
        } else if (result.error) {
          setLoadError(result.error)
        }
      } catch {
        setLoadError('Failed to load tax returns')
      } finally {
        setLoading(false)
      }
    }
    loadReturns()
  }, [])

  const loadDocuments = useCallback(async ({ clearMessages = true } = {}) => {
    if (!selectedReturnId) return
    const returnId = selectedReturnId
    activeReturnRef.current = returnId
    setDocumentsLoading(true)
    setViewingDoc(null)
    setLoadError(null)
    if (clearMessages) {
      setUploadError(null)
      setUploadSuccess(null)
    }

    try {
      const result = await api.portalDocuments(returnId)
      if (activeReturnRef.current !== returnId) return
      if (result.data) {
        setDocuments(result.data.documents)
      } else if (result.error) {
        setLoadError(result.error)
      }
    } catch {
      if (activeReturnRef.current === returnId) setLoadError('Failed to load documents')
    } finally {
      if (activeReturnRef.current === returnId) setDocumentsLoading(false)
    }
  }, [selectedReturnId])

  useEffect(() => {
    setQueuedDocuments([])
    loadDocuments()
  }, [loadDocuments])

  const queueFiles = useCallback((files: File[]) => {
    setUploadError(null)
    setUploadSuccess(null)

    const invalidSize = files.find(file => file.size > MAX_FILE_SIZE)
    if (invalidSize) {
      setUploadError(`${invalidSize.name} is too large. Maximum file size is 50MB.`)
      return
    }

    const invalidType = files.find(file => !isAllowedDocumentFile(file))
    if (invalidType) {
      setUploadError(`${invalidType.name} is not supported. Accepted files include PDF, images, Word, Excel, PowerPoint, CSV, and text files.`)
      return
    }

    setQueuedDocuments(prev => [
      ...prev,
      ...files.map(file => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        documentType: inferDocumentType(file.name),
      })),
    ])
  }, [])

  const updateQueuedType = (id: string, documentType: string) => {
    setQueuedDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, documentType } : doc))
  }

  const removeQueuedDocument = (id: string) => {
    setQueuedDocuments(prev => prev.filter(doc => doc.id !== id))
  }

  const uploadQueuedDocuments = async () => {
    if (!selectedReturnId || queuedDocuments.length === 0 || uploading) return
    const returnId = selectedReturnId

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    let uploadedCount = 0
    const uploadedIds: string[] = []
    try {
      for (const queuedDoc of queuedDocuments) {
        const file = queuedDoc.file
        const contentType = getDocumentContentType(file)

        const presignResult = await api.portalPresignDocument(returnId, {
          filename: file.name,
          content_type: contentType,
          file_size: file.size,
        })

        if (presignResult.error || !presignResult.data) throw new Error(presignResult.error || `Could not prepare ${file.name}`)

        const uploadResponse = await fetch(presignResult.data.upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        })

        if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name}. Please try again.`)

        const registerResult = await api.portalCreateDocument(returnId, {
          filename: file.name,
          s3_key: presignResult.data.s3_key,
          content_type: contentType,
          file_size: file.size,
          document_type: queuedDoc.documentType,
        })

        if (registerResult.error) throw new Error(registerResult.error)
        uploadedCount += 1
        uploadedIds.push(queuedDoc.id)
      }

      setQueuedDocuments([])
      setUploadSuccess(`${uploadedCount} document${uploadedCount === 1 ? '' : 's'} uploaded successfully.`)
      loadDocuments({ clearMessages: false })
    } catch (err) {
      if (uploadedIds.length > 0) {
        setQueuedDocuments(prev => prev.filter(doc => !uploadedIds.includes(doc.id)))
        loadDocuments({ clearMessages: false })
      }
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) queueFiles(files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (uploading) return
    queueFiles(Array.from(e.dataTransfer.files || []))
  }

  const fetchViewUrl = useCallback(async () => {
    if (!viewingDoc || !viewingReturnIdRef.current) return null
    const result = await api.portalGetDocumentDownloadUrl(viewingReturnIdRef.current, viewingDoc.id, 'inline')
    return result.data?.download_url || null
  }, [viewingDoc])

  const fetchDownloadUrl = useCallback(async () => {
    if (!viewingDoc || !viewingReturnIdRef.current) return null
    const result = await api.portalGetDocumentDownloadUrl(viewingReturnIdRef.current, viewingDoc.id, 'attachment')
    return result.data?.download_url || null
  }, [viewingDoc])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (loadError && taxReturns.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
          <p className="text-gray-500 mt-1">Upload and manage your tax documents.</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-red-600 underline text-sm">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (taxReturns.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
          <p className="text-gray-500 mt-1">Upload and manage your tax documents.</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-dark p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No tax returns found</p>
          <p className="text-gray-400 text-sm mt-1">Documents will be available once your intake form is processed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <p className="text-gray-500 mt-1">Upload, preview, and download your tax documents.</p>
      </div>

      {taxReturns.length > 1 && (
        <div className="bg-white rounded-xl border border-secondary-dark p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Tax Year:</label>
            <select
              value={selectedReturnId || ''}
              onChange={e => setSelectedReturnId(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-secondary-dark rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {taxReturns.map(tr => <option key={tr.id} value={tr.id}>{tr.tax_year}</option>)}
            </select>
            {documentsLoading && <span className="text-xs text-gray-400">Refreshing...</span>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Upload Documents</h2>
        <p className="text-sm text-gray-500 mb-4">Select one or more files first. Nothing uploads until you confirm.</p>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive ? 'border-primary bg-primary/5' : uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-primary/50 hover:bg-secondary/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={ACCEPTED_DOCUMENT_EXTENSIONS}
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            multiple
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 font-medium"><span className="text-primary">Click to choose files</span> or drag and drop</p>
              <p className="text-xs text-gray-400 mt-1">PDF, images, Word, Excel, PowerPoint, CSV, or text up to 50MB each</p>
            </div>
          </div>
        </div>

        {queuedDocuments.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Confirm upload</h3>
                <p className="text-xs text-gray-500">Review your selected files before sending them to Cornerstone.</p>
              </div>
              <button
                type="button"
                onClick={uploadQueuedDocuments}
                disabled={uploading}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-60"
              >
                {uploading ? 'Uploading...' : `Upload ${queuedDocuments.length} document${queuedDocuments.length === 1 ? '' : 's'}`}
              </button>
            </div>

            <div className="space-y-2">
              {queuedDocuments.map(doc => (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-white p-3 border border-gray-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(doc.file.size)}</p>
                  </div>
                  <select
                    value={doc.documentType}
                    onChange={(e) => updateQueuedType(doc.id, e.target.value)}
                    className="px-3 py-2 border border-secondary-dark rounded-lg text-sm bg-white"
                    aria-label={`Document type for ${doc.file.name}`}
                  >
                    {DOCUMENT_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeQueuedDocument(doc.id)}
                    disabled={uploading}
                    className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {uploadSuccess}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Uploaded Documents ({documents.length})</h2>
          {documentsLoading && documents.length > 0 && <span className="text-xs text-gray-400">Refreshing...</span>}
        </div>

        {documents.length === 0 ? (
          <div className="py-8 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No documents uploaded yet</p>
            <p className="text-gray-400 text-sm mt-1">Use the form above to upload your first document.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-3.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                onClick={() => openDocViewer(doc)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>{doc.document_type?.replaceAll('_', ' ') || 'Other'}</span>
                      <span>·</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>·</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${uploadSourceClasses(doc.uploaded_by_source)}`}>
                        {doc.uploaded_by_source === 'staff' ? 'From Cornerstone' : 'Uploaded by you'}
                      </span>
                    </div>
                  </div>
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

      <DocumentViewer
        isOpen={!!viewingDoc}
        onClose={closeViewer}
        filename={viewingDoc?.filename || ''}
        contentType={viewingDoc?.content_type || null}
        onFetchUrl={fetchViewUrl}
        onFetchDownloadUrl={fetchDownloadUrl}
      />
    </div>
  )
}
