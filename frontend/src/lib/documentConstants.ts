// Keep in sync with backend DocumentValidatable concern
// (backend/app/controllers/concerns/document_validatable.rb)
export const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
