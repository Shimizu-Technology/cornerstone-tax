import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

interface TaxReturnSummary {
  id: number
  tax_year: number
  status: string
}

interface PortalDocument {
  id: number
  filename: string
  document_type: string
  content_type: string
  file_size: number
  uploaded_by: string | null
  created_at: string
}

const DOCUMENT_TYPES = [
  { value: 'w2', label: 'W-2' },
  { value: '1099', label: '1099' },
  { value: 'id', label: 'Photo ID' },
  { value: 'prior_return', label: 'Prior Year Return' },
  { value: 'other', label: 'Other' },
]

export default function PortalDocuments() {
  useEffect(() => { document.title = 'Documents | Cornerstone Client Portal' }, [])

  const [taxReturns, setTaxReturns] = useState<TaxReturnSummary[]>([])
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState('other')

  useEffect(() => {
    async function loadReturns() {
      try {
        const result = await api.portalTaxReturns()
        if (result.data) {
          const returns = (result.data as { tax_returns: TaxReturnSummary[] }).tax_returns
          setTaxReturns(returns)
          if (returns.length > 0) {
            setSelectedReturnId(returns[0].id)
          }
        }
      } catch {
        // handled by empty state
      } finally {
        setLoading(false)
      }
    }
    loadReturns()
  }, [])

  const loadDocuments = useCallback(async () => {
    if (!selectedReturnId) return
    try {
      const result = await api.portalDocuments(selectedReturnId)
      if (result.data) {
        setDocuments((result.data as { documents: PortalDocument[] }).documents)
      }
    } catch {
      // handled by empty state
    }
  }, [selectedReturnId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedReturnId) return

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

      setUploadSuccess(`${file.name} uploaded successfully!`)
      loadDocuments()
      e.target.value = ''
    } catch {
      setUploadError('An unexpected error occurred. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (taxReturns.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <div className="bg-white rounded-xl border border-secondary-dark p-8 text-center">
          <p className="text-gray-500">No tax returns found.</p>
          <p className="text-gray-400 text-sm mt-1">Documents will be available once your intake form is processed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>

      {/* Tax Return Selector */}
      {taxReturns.length > 1 && (
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
      )}

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-secondary-dark p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Upload a Document</h2>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="w-full px-3 py-2.5 border border-secondary-dark rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {DOCUMENT_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <label className={`flex items-center justify-center px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading ? 'border-gray-200 bg-gray-50' : 'border-primary/30 hover:border-primary hover:bg-primary/5'
            }`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  Uploading...
                </div>
              ) : (
                <span className="text-sm text-primary font-medium">Choose file (PDF, JPEG, PNG)</span>
              )}
            </label>
          </div>
        </div>

        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
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
          <p className="text-gray-400 text-sm py-4">No documents uploaded yet. Use the form above to upload your first document.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400">
                      {doc.document_type?.replace('_', ' ') || 'Other'}
                      {' · '}
                      {formatFileSize(doc.file_size)}
                      {' · '}
                      {new Date(doc.created_at).toLocaleDateString()}
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
