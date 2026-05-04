import { describe, expect, it } from 'vitest'
import { getDocumentContentType, inferDocumentType } from './documentConstants'

describe('documentConstants', () => {
  describe('inferDocumentType', () => {
    it('only treats id as a standalone filename token', () => {
      expect(inferDocumentType('photo-id.pdf')).toBe('id')
      expect(inferDocumentType('paid_invoice.pdf')).toBe('other')
      expect(inferDocumentType('grid-summary.pdf')).toBe('other')
    })

    it('recognizes common tax document names', () => {
      expect(inferDocumentType('2026-final-return.pdf')).toBe('final_return')
      expect(inferDocumentType('tax-organizer.xlsx')).toBe('organizer')
      expect(inferDocumentType('supporting-statement.csv')).toBe('supporting_statement')
    })
  })

  describe('getDocumentContentType', () => {
    it('prefers the extension map over ambiguous browser MIME types', () => {
      const csvFile = new File(['a,b'], 'report.csv', { type: 'application/vnd.ms-excel' })

      expect(getDocumentContentType(csvFile)).toBe('text/csv')
    })
  })
})
