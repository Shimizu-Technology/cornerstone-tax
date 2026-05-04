// Keep in sync with backend DocumentValidatable concern
// (backend/app/controllers/concerns/document_validatable.rb)
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
] as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
export const ACCEPTED_DOCUMENT_EXTENSIONS = ALLOWED_FILE_EXTENSIONS.join(',')

// Keep in sync with backend Document::DOCUMENT_TYPES
// (backend/app/models/document.rb)
export const DOCUMENT_TYPES = [
  { value: 'w2', label: 'W-2' },
  { value: '1099', label: '1099' },
  { value: 'id', label: 'Photo ID' },
  { value: 'prior_return', label: 'Prior Year Return' },
  { value: 'draft_return', label: 'Draft Return' },
  { value: 'final_return', label: 'Final Return' },
  { value: 'tax_notice', label: 'Tax Notice' },
  { value: 'organizer', label: 'Tax Organizer' },
  { value: 'supporting_statement', label: 'Supporting Statement' },
  { value: 'other', label: 'Other' },
] as const

const CONTENT_TYPE_BY_EXTENSION: Record<string, typeof ALLOWED_CONTENT_TYPES[number]> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export const getDocumentExtension = (filename: string) => {
  const match = filename.toLowerCase().match(/\.[^.]+$/)
  return match?.[0] || ''
}

export const getDocumentContentType = (file: File) => {
  if (ALLOWED_CONTENT_TYPES.includes(file.type as typeof ALLOWED_CONTENT_TYPES[number])) {
    return file.type
  }

  return CONTENT_TYPE_BY_EXTENSION[getDocumentExtension(file.name)] || file.type || 'application/octet-stream'
}

export const isAllowedDocumentFile = (file: File) => {
  const contentType = getDocumentContentType(file)
  return ALLOWED_CONTENT_TYPES.includes(contentType as typeof ALLOWED_CONTENT_TYPES[number])
    && ALLOWED_FILE_EXTENSIONS.includes(getDocumentExtension(file.name) as typeof ALLOWED_FILE_EXTENSIONS[number])
}
