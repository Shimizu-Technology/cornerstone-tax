import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import type { ServiceType } from '../../lib/api'

interface QuickCreateClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (clientId: number) => void
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  filing_status: string
  tax_year: number
  client_type: 'individual' | 'business'
  business_name: string
  is_service_only: boolean
  service_type_ids: number[]
}

const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_widow', label: 'Qualifying Widow(er)' },
]

export default function QuickCreateClientModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickCreateClientModalProps) {
  const currentYear = new Date().getFullYear()
  
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    filing_status: 'single',
    tax_year: currentYear,
    client_type: 'individual',
    business_name: '',
    is_service_only: false,
    service_type_ids: [],
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false)

  // Load service types when modal opens
  useEffect(() => {
    if (isOpen) {
      loadServiceTypes()
    }
  }, [isOpen])

  const loadServiceTypes = async () => {
    setLoadingServiceTypes(true)
    try {
      const result = await api.getServiceTypes()
      if (result.data) {
        setServiceTypes(result.data.service_types)
      }
    } catch (error) {
      console.error('Failed to load service types:', error)
    } finally {
      setLoadingServiceTypes(false)
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const toggleServiceType = (serviceTypeId: number) => {
    setFormData((prev) => {
      const current = prev.service_type_ids
      if (current.includes(serviceTypeId)) {
        return { ...prev, service_type_ids: current.filter(id => id !== serviceTypeId) }
      } else {
        return { ...prev, service_type_ids: [...current, serviceTypeId] }
      }
    })
  }

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.preventDefault?.()

    const validationErrors: string[] = []
    if (formData.client_type === 'business' && !formData.business_name.trim()) {
      validationErrors.push('Business name is required')
    }
    if (!formData.first_name.trim()) validationErrors.push('First name is required')
    if (!formData.last_name.trim()) validationErrors.push('Last name is required')
    if (!formData.email.trim()) validationErrors.push('Email is required')
    if (!formData.phone.trim()) validationErrors.push('Phone is required')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors([])

    try {
      const result = await api.createClient({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        date_of_birth: formData.date_of_birth || null,
        filing_status: formData.filing_status,
        tax_year: formData.tax_year,
        is_new_client: true,
        client_type: formData.client_type,
        business_name: formData.client_type === 'business' ? formData.business_name : undefined,
        is_service_only: formData.is_service_only,
        service_type_ids: formData.service_type_ids,
        contacts: formData.client_type === 'business' ? [{
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          role: 'Primary',
          is_primary: true,
        }] : undefined,
      })

      if (result.error || result.errors?.length) {
        setErrors(result.errors || [result.error || 'Failed to create client'])
        return
      }

      if (result.data) {
          onSuccess(result.data.client.id)
        // Reset form
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          date_of_birth: '',
          filing_status: 'single',
          tax_year: currentYear,
          client_type: 'individual',
          business_name: '',
          is_service_only: false,
          service_type_ids: [],
        })
        onClose()
      }
    } catch (error) {
      console.error('Error creating client:', error)
      setErrors(['An unexpected error occurred'])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="quick-create-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-dark sticky top-0 bg-white z-10">
            <h2 id="quick-create-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
              Quick Create Client
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
                <ul className="text-sm text-red-600 space-y-1">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Client Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, client_type: 'individual' }))}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formData.client_type === 'individual'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                  }`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, client_type: 'business' }))}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formData.client_type === 'business'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                  }`}
                >
                  Business
                </button>
              </div>
            </div>

            {/* Business Name (only for business clients) */}
            {formData.client_type === 'business' && (
              <div>
                <label htmlFor="qc-business-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name *
                </label>
                <input
                  id="qc-business-name"
                  type="text"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  required={formData.client_type === 'business'}
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}

            {/* Primary Contact Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="qc-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.client_type === 'business' ? 'Primary Contact First Name *' : 'First Name *'}
                </label>
                <input
                  id="qc-first-name"
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="qc-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.client_type === 'business' ? 'Primary Contact Last Name *' : 'Last Name *'}
                </label>
                <input
                  id="qc-last-name"
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="qc-email" className="block text-sm font-medium text-gray-700 mb-1">
                {formData.client_type === 'business' ? 'Primary Contact Email *' : 'Email *'}
              </label>
              <input
                id="qc-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="qc-phone" className="block text-sm font-medium text-gray-700 mb-1">
                {formData.client_type === 'business' ? 'Primary Contact Phone *' : 'Phone *'}
              </label>
              <input
                id="qc-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="6711234567"
                className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Service-Only Toggle */}
            <div className="p-4 bg-secondary/50 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_service_only"
                  checked={formData.is_service_only}
                  onChange={handleChange}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Service Client Only</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    This client receives ongoing services (payroll, bookkeeping, etc.) without a tax return.
                  </p>
                </div>
              </label>
            </div>

            {/* Service Types Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Services {formData.is_service_only && <span className="text-gray-400">(recommended)</span>}
              </label>
              {loadingServiceTypes ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {serviceTypes.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleServiceType(st.id)}
                      className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                        formData.service_type_ids.includes(st.id)
                          ? 'bg-primary text-white'
                          : 'bg-secondary text-gray-700 hover:bg-secondary-dark'
                      }`}
                    >
                      {st.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tax Return Fields (only if NOT service-only) */}
            {!formData.is_service_only && (
              <>
                <div className="border-t border-secondary-dark pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Tax Return Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="qc-date-of-birth" className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        id="qc-date-of-birth"
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="qc-tax-year" className="block text-sm font-medium text-gray-700 mb-1">
                        Tax Year
                      </label>
                      <select
                        id="qc-tax-year"
                        name="tax_year"
                        value={formData.tax_year}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value={currentYear}>{currentYear}</option>
                        <option value={currentYear - 1}>{currentYear - 1}</option>
                        <option value={currentYear - 2}>{currentYear - 2}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="qc-filing-status" className="block text-sm font-medium text-gray-700 mb-1">
                    Filing Status
                  </label>
                  <select
                    id="qc-filing-status"
                    name="filing_status"
                    value={formData.filing_status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {FILING_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <p className="text-xs text-gray-500">
              * Required fields. Additional details can be added on the client detail page.
            </p>

            {/* Actions */}
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
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.div>
    </AnimatePresence>
  )
}
