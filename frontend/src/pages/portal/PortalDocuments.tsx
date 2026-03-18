import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import type { PortalTaxReturnSummary, PortalDocument } from '../../lib/api'
import { formatFileSize } from '../../lib/formatUtils'
import DocumentViewer from '../../components/common/DocumentViewer'

const DOCUMENT_TYPES = [
  { value: 'w2', label: 'W-2' },
  { value: '1099', label: '1099' },
  { value: 'id', label: 'Photo ID' },
  { value: 'prior_return', label: 'Prior Year Return' },
  { value: 'other', label: 'Other' },
]

export default function PortalDocuments() {
  useEffect(() => { document.title = 'Documents | Cornerstone Client Portal' }, [])

  const [taxReturns, setTaxReturns] = useState<PortalTaxReturnSummary[]>([])
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState('other')
  const [dragActive, setDragActive] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<PortalDocument | null>(null)
  const viewingReturnIdRef = useRef<number | null>(null)

  const openDocViewer = useCallback((doc: PortalDocument) => {
    viewingReturnIdRef.current = selectedReturnId
    setViewingDoc(doc)
  }, [selectedReturnId])

  useEffect(() => {
    async function loadReturns() {
      try {
        const result = await api.portalTaxReturns()
        if (result.data) {
          const returns = result.data.tax_returns
          setTaxReturns(returns)
          if (returns.length > 0) {
            setSelectedReturnId(returns[0].id)
          }
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

  const activeReturnRef = useRef(selectedReturnId)

  const loadDocuments = useCallback(async () => {
    if (!selectedReturnId) return
    activeReturnRef.current = selectedReturnId
    setDocuments([])
    try {
      const result = await api.portalDocuments(selectedReturnId)
      if (activeReturnRef.current !== selectedReturnId) return
      if (result.data) {
        setDocuments(result.data.documents)
      } else if (result.error) {
        setLoadError(result.error)
      }
    } catch {
      if (activeReturnRef.current === selectedReturnId) {
        setLoadError('Failed to load documents')
      }
    }
  }, [selectedReturnId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const uploadFile = async (file: File) => {
    if (!selectedReturnId) return

    setUploadError(null)
    setUploadSuccess(null)
    setUploading(true)

    try {
      const presignResult = await api.portalPresignDocument(selectedReturnId, {
        filename: file.name,
        content_type: file.type,
        file_size: file.size,
      })

      if (presignResult.error) {
        setUploadError(presignResult.error)
        return
      }

      const presignData = presignResult.data as { upload_url: string; s3_key: string }

      const uploadResponse = await fetch(presignData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadResponse.ok) {
        setUploadError('Failed to upload file. Please try again.')
        return
      }

      const registerResult = await api.portalCreateDocument(selectedReturnId, {
        filename: file.name,
        s3_key: presignData.s3_key,
        content_type: file.type,
        file_size: file.size,
        document_type: documentType,
      })

      if (registerResult.error) {
        setUploadError(registerResult.error)
        return
      }

      setUploadSuccess(`"${file.name}" uploaded successfully!`)
      loadDocuments()
    } catch {
      setUploadError('An unexpected error occurred. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  const fetchViewUrl = useCallback(async () => {
    if (!viewingDoc || !viewingReturnIdRef.current) return null
    const result = await api.portalGetDocumentDownloadUrl(viewingReturnIdRef.current, viewingDoc.id)
    return result.data?.download_url || null
  }, [viewingDoc])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (loadError) {
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
        <p className="text-gray-500 mt-1">Upload and manage your tax documents.</p>
      </div>

      {/* Tax Return Selector */}
      {taxReturns.length > 1 && (
        <div className="bg-white rounded-xl border border-secondary-dark p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Tax Year:</label>
            <select
              value={selectedReturnId || ''}
              onChange={e => setSelectedReturnId(parseInt(e.target.value))}
              className="px-3 py-2 border border-secondary-dark rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {taxReturns.map(tr => (
                <option key={tr.id} value={tr.id}>{tr.tax_year}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Upload a Document</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Type</label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="w-full px-3 py-2.5 border border-secondary-dark rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
            >
              {DOCUMENT_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-primary bg-primary/5'
              : uploading
              ? 'border-gray-200 bg-gray-50'
              : 'border-gray-300 hover:border-primary/50 hover:bg-secondary/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-gray-500 font-medium">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-gray-700 font-medium">
                  <span className="text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPEG, or PNG up to 50MB</p>
              </div>
            </div>
          )}
        </div>

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

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <h2 className="font-semibold text-gray-900 mb-3">
          Uploaded Documents ({documents.length})
        </h2>

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
                    {doc.content_type?.startsWith('image/') ? (
                      <svg className="w-5 h-5 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.document_type?.replaceAll('_', ' ') || 'Other'}
                      {' · '}
                      {formatFileSize(doc.file_size)}
                      {' · '}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
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
        onClose={() => setViewingDoc(null)}
        filename={viewingDoc?.filename || ''}
        contentType={viewingDoc?.content_type || null}
        onFetchUrl={fetchViewUrl}
      />
    </div>
  )
}
