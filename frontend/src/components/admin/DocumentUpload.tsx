import { useState, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import type { Document } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'

interface DocumentUploadProps {
  taxReturnId: number
  documents: Document[]
  onDocumentsChange: () => void
}

const DOCUMENT_TYPES = [
  { value: 'w2', label: 'W-2' },
  { value: '1099', label: '1099' },
  { value: 'id', label: 'ID / Driver\'s License' },
  { value: 'prior_return', label: 'Prior Year Return' },
  { value: 'other', label: 'Other' },
]

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentUpload({ taxReturnId, documents, onDocumentsChange }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState('other')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadFile = async (file: File) => {
    setError(null)
    setUploading(true)
    setUploadProgress('Getting upload URL...')

    try {
      // 1. Get presigned URL
      const presignResult = await api.presignDocumentUpload(
        taxReturnId,
        file.name,
        file.type || 'application/octet-stream'
      )

      if (presignResult.error || !presignResult.data) {
        throw new Error(presignResult.error || 'Failed to get upload URL')
      }

      const { upload_url, s3_key } = presignResult.data

      // 2. Upload to S3
      setUploadProgress('Uploading to cloud...')
      console.log('Uploading to S3:', upload_url.substring(0, 100) + '...')
      
      try {
        const uploadResponse = await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        })

        console.log('S3 upload response:', uploadResponse.status, uploadResponse.statusText)

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'No error details')
          console.error('S3 upload error:', errorText)
          throw new Error(`Failed to upload file to cloud storage: ${uploadResponse.status}`)
        }
      } catch (fetchError) {
        console.error('S3 fetch error:', fetchError)
        throw new Error('Failed to upload to cloud. Check browser console for details.')
      }

      // 3. Register document in database
      setUploadProgress('Registering document...')
      const registerResult = await api.registerDocument(taxReturnId, {
        filename: file.name,
        s3_key: s3_key,
        content_type: file.type || 'application/octet-stream',
        file_size: file.size,
        document_type: selectedType,
      })

      if (registerResult.error) {
        throw new Error(registerResult.error)
      }

      // Immediately refresh the documents list
      setUploadProgress(null)
      setUploading(false)
      onDocumentsChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(null)
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFile(files[0])
    }
  }, [taxReturnId, selectedType])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDownload = async (doc: Document) => {
    try {
      const result = await api.getDocumentDownloadUrl(doc.id)
      if (result.data?.download_url) {
        window.open(result.data.download_url, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return

    try {
      await api.deleteDocument(doc.id)
      onDocumentsChange()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

      {/* Document Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Document Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
        />

        {uploading ? (
          <div>
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600">{uploadProgress}</p>
          </div>
        ) : (
          <>
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-1">
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-gray-500">PDF, images, or documents up to 25MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-8 h-8 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      {doc.document_type?.toUpperCase() || 'Other'} • {formatFileSize(doc.file_size)} • {formatDateTime(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-gray-500 hover:text-primary transition-colors"
                    title="Download"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && !uploading && (
        <p className="mt-4 text-sm text-gray-500 text-center">No documents uploaded yet</p>
      )}
    </div>
  )
}
