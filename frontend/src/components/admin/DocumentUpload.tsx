import { useState, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import type { Document } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'
import { formatFileSize } from '../../lib/formatUtils'
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPES,
  MAX_FILE_SIZE,
  getDocumentContentType,
  inferDocumentType,
  isAllowedDocumentFile,
} from '../../lib/documentConstants'
import DocumentViewer from '../common/DocumentViewer'

interface DocumentUploadProps {
  taxReturnId: number
  documents: Document[]
  onDocumentsChange: () => void
}

type QueuedDocument = {
  id: string
  file: File
  documentType: string
}

const uploadSourceClasses = (source?: 'client' | 'staff') => (
  source === 'staff'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
)

export default function DocumentUpload({ taxReturnId, documents, onDocumentsChange }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [queuedDocuments, setQueuedDocuments] = useState<QueuedDocument[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queueFiles = useCallback((files: File[]) => {
    setError(null)
    setSuccess(null)

    const invalidSize = files.find(file => file.size > MAX_FILE_SIZE)
    if (invalidSize) {
      setError(`${invalidSize.name} is too large. Maximum file size is 50MB.`)
      return
    }

    const invalidType = files.find(file => !isAllowedDocumentFile(file))
    if (invalidType) {
      setError(`${invalidType.name} is not supported. Accepted files include PDF, images, Word, Excel, PowerPoint, CSV, and text files.`)
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (uploading) return
    queueFiles(Array.from(e.dataTransfer.files))
  }, [queueFiles, uploading])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) queueFiles(files)
    e.target.value = ''
  }

  const updateQueuedType = (id: string, documentType: string) => {
    setQueuedDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, documentType } : doc))
  }

  const removeQueuedDocument = (id: string) => {
    setQueuedDocuments(prev => prev.filter(doc => doc.id !== id))
  }

  const uploadQueuedDocuments = async () => {
    if (queuedDocuments.length === 0 || uploading) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    let uploadedCount = 0
    const uploadedIds: string[] = []
    try {
      for (const [index, queuedDoc] of queuedDocuments.entries()) {
        const file = queuedDoc.file
        const contentType = getDocumentContentType(file)
        setUploadProgress(`Uploading ${index + 1} of ${queuedDocuments.length}: ${file.name}`)

        const presignResult = await api.presignDocumentUpload(taxReturnId, file.name, contentType, file.size)
        if (presignResult.error || !presignResult.data) throw new Error(presignResult.error || `Could not prepare ${file.name}`)

        const uploadResponse = await fetch(presignResult.data.upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        })
        if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name}`)

        const registerResult = await api.registerDocument(taxReturnId, {
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
      setSuccess(`${uploadedCount} document${uploadedCount === 1 ? '' : 's'} uploaded for this client.`)
      onDocumentsChange()
    } catch (err) {
      if (uploadedIds.length > 0) {
        setQueuedDocuments(prev => prev.filter(doc => !uploadedIds.includes(doc.id)))
        onDocumentsChange()
      }
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadProgress(null)
      setUploading(false)
    }
  }

  const handleDownload = async (doc: Document) => {
    try {
      const result = await api.getDocumentDownloadUrl(taxReturnId, doc.id, 'attachment')
      if (result.data?.download_url) window.open(result.data.download_url, '_blank')
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const fetchViewUrl = useCallback(async () => {
    if (!viewingDoc) return null
    const result = await api.getDocumentDownloadUrl(taxReturnId, viewingDoc.id, 'inline')
    return result.data?.download_url || null
  }, [viewingDoc, taxReturnId])

  const fetchDownloadUrl = useCallback(async () => {
    if (!viewingDoc) return null
    const result = await api.getDocumentDownloadUrl(taxReturnId, viewingDoc.id, 'attachment')
    return result.data?.download_url || null
  }, [viewingDoc, taxReturnId])

  const closeViewer = useCallback(() => setViewingDoc(null), [])

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return

    try {
      await api.deleteDocument(taxReturnId, doc.id)
      onDocumentsChange()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Documents</h2>
          <p className="text-sm text-gray-500 mt-1">Upload client documents, draft returns, notices, and finished files for portal review.</p>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Select client documents to upload"
          onChange={handleFileSelect}
          className="hidden"
          accept={ACCEPTED_DOCUMENT_EXTENSIONS}
          multiple
        />

        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-600 mb-1">
          <span className="font-medium text-primary">Choose documents</span> or drag and drop
        </p>
        <p className="text-sm text-gray-500">PDF, images, Word, Excel, PowerPoint, CSV, or text up to 50MB each</p>
      </div>

      {queuedDocuments.length > 0 && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Ready to upload</h3>
              <p className="text-xs text-gray-500">Review the files below, then confirm the upload.</p>
            </div>
            <button
              type="button"
              onClick={uploadQueuedDocuments}
              disabled={uploading}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : `Upload ${queuedDocuments.length} document${queuedDocuments.length === 1 ? '' : 's'}`}
            </button>
          </div>

          <div className="space-y-2">
            {queuedDocuments.map(doc => (
              <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-white p-3 border border-gray-100">
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
                  {DOCUMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
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

      {uploading && uploadProgress && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
          {uploadProgress}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {success}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setViewingDoc(doc)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{doc.document_type?.replaceAll('_', ' ').toUpperCase() || 'Other'}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{formatDateTime(doc.created_at)}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${uploadSourceClasses(doc.uploaded_by_source)}`}>
                        {doc.uploaded_by_label || 'Uploaded by client'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setViewingDoc(doc) }} className="p-2 text-gray-500 hover:text-primary transition-colors" title="Preview">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDownload(doc) }} className="p-2 text-gray-500 hover:text-primary transition-colors" title="Download">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(doc) }} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
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
