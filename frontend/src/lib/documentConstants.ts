// Keep in sync with backend DocumentValidatable concern
// (backend/app/controllers/concerns/document_validatable.rb)
export const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// Keep in sync with backend Document::DOCUMENT_TYPES
// (backend/app/models/document.rb)
export const DOCUMENT_TYPES = [
  { value: 'w2', label: 'W-2' },
  { value: '1099', label: '1099' },
  { value: 'id', label: 'Photo ID' },
  { value: 'prior_return', label: 'Prior Year Return' },
  { value: 'other', label: 'Other' },
] as const
