import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { api } from '../../lib/api'
import type { BulkImportResultItem } from '../../lib/api'

interface BulkImportClientsModalProps {
  onClose: () => void
}

const CSV_TEMPLATE = `full_name,email,phone,client_type,business_name,service_types
Leon Shimizu,leon@example.com,671-483-0219,individual,,Tax Preparation
Shimizu LLC,billing@example.com,671-000-0000,business,Shimizu LLC,"Tax Preparation,Bookkeeping"
`

const CSV_HEADERS = ['full_name', 'email', 'phone', 'client_type', 'business_name', 'service_types']

interface PreviewRow {
  [key: string]: string
}

interface ImportResults {
  message: string
  created: BulkImportResultItem[]
  skipped: BulkImportResultItem[]
  errors: BulkImportResultItem[]
}

function parseCSVPreview(text: string): PreviewRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Simple CSV header parse (first line)
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: PreviewRow[] = []

  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    const line = lines[i]
    // Handle quoted fields
    const values: string[] = []
    let current = ''
    let inQuote = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())

    const row: PreviewRow = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }
  return rows
}

export default function BulkImportClientsModal({ onClose }: BulkImportClientsModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'client-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file.')
      return
    }
    setSelectedFile(file)
    setResults(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSVPreview(text)
      setPreviewRows(rows)
    }
    reader.readAsText(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleImport = async () => {
    if (!selectedFile) return
    setLoading(true)
    setError(null)

    try {
      const result = await api.bulkImportClients(selectedFile)
      if (result.error || !result.data) {
        setError(result.error || 'Import failed')
        return
      }
      setResults({
        message: result.data.message,
        created: result.data.results.created,
        skipped: result.data.results.skipped,
        errors: result.data.results.errors,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-import-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-dark sticky top-0 bg-white z-10">
              <h2 id="bulk-import-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Import Clients from CSV
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Instructions */}
              <p className="text-sm text-gray-600">
                Upload a CSV file with client data. Download the template below to get started.
              </p>

              {/* Download Template */}
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 border border-secondary-dark text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>

              {/* File Input / Drop Zone */}
              {!results && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : selectedFile
                      ? 'border-green-400 bg-green-50'
                      : 'border-secondary-dark hover:border-primary hover:bg-primary/5'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-green-500" />
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700">
                        Drop your CSV file here, or click to browse
                      </p>
                      <p className="text-xs text-gray-500">Only .csv files are accepted</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Preview Table */}
              {previewRows.length > 0 && !results && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Preview (first {previewRows.length} row{previewRows.length !== 1 ? 's' : ''})
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-secondary-dark">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/50">
                        <tr>
                          {CSV_HEADERS.map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-secondary-dark">
                            {CSV_HEADERS.map((h) => (
                              <td key={h} className="px-3 py-2 text-gray-700 max-w-[120px] truncate">
                                {row[h] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Button */}
              {!results && (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 border border-secondary-dark text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!selectedFile || loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import Clients
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-sm text-blue-700 font-medium">{results.message}</p>
                  </div>

                  {/* Created */}
                  {results.created.length > 0 && (
                    <ResultSection
                      title={`Created (${results.created.length})`}
                      items={results.created}
                      variant="success"
                    />
                  )}

                  {/* Skipped */}
                  {results.skipped.length > 0 && (
                    <ResultSection
                      title={`Skipped (${results.skipped.length})`}
                      items={results.skipped}
                      variant="warning"
                    />
                  )}

                  {/* Errors */}
                  {results.errors.length > 0 && (
                    <ResultSection
                      title={`Errors (${results.errors.length})`}
                      items={results.errors}
                      variant="error"
                    />
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface ResultSectionProps {
  title: string
  items: BulkImportResultItem[]
  variant: 'success' | 'warning' | 'error'
}

function ResultSection({ title, items, variant }: ResultSectionProps) {
  const styles = {
    success: {
      header: 'bg-green-50 border-green-200 text-green-700',
      row: 'border-green-100',
      icon: <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />,
    },
    warning: {
      header: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      row: 'border-yellow-100',
      icon: <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />,
    },
    error: {
      header: 'bg-red-50 border-red-200 text-red-700',
      row: 'border-red-100',
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />,
    },
  }

  const s = styles[variant]

  return (
    <div className={`border rounded-xl overflow-hidden ${s.header.split(' ').filter(c => c.startsWith('border')).join(' ')}`}>
      <div className={`px-4 py-2.5 text-sm font-medium ${s.header}`}>
        {title}
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 px-4 py-2.5">
            {s.icon}
            <div className="min-w-0">
              {item.name && (
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
              )}
              <p className="text-xs text-gray-500 truncate">{item.email}</p>
              {item.reason && (
                <p className="text-xs text-gray-400 mt-0.5">{item.reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
