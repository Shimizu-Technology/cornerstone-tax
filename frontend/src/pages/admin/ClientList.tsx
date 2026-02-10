import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ServiceType, ClientServiceType } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'
import QuickCreateClientModal from '../../components/admin/QuickCreateClientModal'
import { FadeUp } from '../../components/ui/MotionComponents'

interface Client {
  id: number
  full_name: string
  email: string
  phone: string
  is_new_client: boolean
  client_type: 'individual' | 'business'
  business_name: string | null
  is_service_only: boolean
  service_types: ClientServiceType[]
  created_at: string
  tax_return: {
    id: number
    tax_year: number
    status: string
    status_slug: string
    status_color: string
    assigned_to: string | null
  } | null
}

interface Meta {
  current_page: number
  per_page: number
  total_count: number
  total_pages: number
}

export default function ClientList() {
  useEffect(() => { document.title = 'Clients | Cornerstone Admin' }, [])

  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')  // Only updates on form submit
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Filter states
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<number | undefined>()
  const [showServiceOnly, setShowServiceOnly] = useState<boolean | undefined>()

  // Load service types for filter dropdown
  useEffect(() => {
    loadServiceTypes()
  }, [])

  async function loadServiceTypes() {
    try {
      const result = await api.getServiceTypes()
      if (result.data) {
        setServiceTypes(result.data.service_types)
      }
    } catch (error) {
      console.error('Failed to load service types:', error)
    }
  }

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getClients({ 
        page, 
        search: appliedSearch, 
        per_page: 20,
        service_type_id: selectedServiceTypeId,
        service_only: showServiceOnly,
      })
      if (result.data) {
        setClients(result.data.clients as Client[])
        setMeta(result.data.meta)
      }
    } catch (error) {
      console.error('Failed to load clients:', error)
    } finally {
      setLoading(false)
    }
  }, [page, appliedSearch, selectedServiceTypeId, showServiceOnly])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setAppliedSearch(search)  // Triggers useEffect to fetch
  }

  const clearFilters = () => {
    setSearch('')
    setAppliedSearch('')  // Clear applied search too
    setSelectedServiceTypeId(undefined)
    setShowServiceOnly(undefined)
    setPage(1)
  }

  const hasActiveFilters = appliedSearch || selectedServiceTypeId !== undefined || showServiceOnly !== undefined

  return (
    <FadeUp>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Clients</h1>
          <p className="text-gray-500 mt-1">
            {meta ? `${meta.total_count} total client${meta.total_count !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Client
        </button>
      </div>

      <QuickCreateClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(clientId) => {
          navigate(`/admin/clients/${clientId}`)
        }}
      />

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark p-5 sm:p-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or business..."
              className="w-full pl-12 pr-4 py-3 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-secondary/30"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-secondary text-gray-700 rounded-xl hover:bg-secondary-dark transition-colors font-medium"
          >
            Search
          </button>
        </form>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Service Type Filter */}
          <select
            value={selectedServiceTypeId || ''}
            onChange={(e) => {
              setSelectedServiceTypeId(e.target.value ? parseInt(e.target.value) : undefined)
              setPage(1)
            }}
            className="px-4 py-2 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white text-sm"
          >
            <option value="">All Services</option>
            {serviceTypes.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>

          {/* Service-Only Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-secondary-dark">
            <button
              type="button"
              onClick={() => { setShowServiceOnly(undefined); setPage(1) }}
              className={`px-4 py-2 min-h-11 text-sm font-medium transition-colors ${
                showServiceOnly === undefined ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-secondary'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => { setShowServiceOnly(false); setPage(1) }}
              className={`px-4 py-2 min-h-11 text-sm font-medium transition-colors border-l border-secondary-dark ${
                showServiceOnly === false ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-secondary'
              }`}
            >
              Tax Clients
            </button>
            <button
              type="button"
              onClick={() => { setShowServiceOnly(true); setPage(1) }}
              className={`px-4 py-2 min-h-11 text-sm font-medium transition-colors border-l border-secondary-dark ${
                showServiceOnly === true ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-secondary'
              }`}
            >
              Service Only
            </button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No clients found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-primary hover:text-primary-dark font-medium"
            >
              Create your first client →
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Services
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-dark">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/admin/clients/${client.id}`} className="flex items-center gap-3 group">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                            client.client_type === 'business' 
                              ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                              : 'bg-gradient-to-br from-primary-light to-primary'
                          }`}>
                            {client.client_type === 'business' ? (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            ) : (
                              <span className="text-white font-semibold">
                                {client.full_name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                              {client.client_type === 'business' && client.business_name 
                                ? client.business_name 
                                : client.full_name}
                            </p>
                            <div className="flex items-center gap-2">
                              {client.client_type === 'business' && client.business_name && (
                                <span className="text-xs text-gray-500">{client.full_name}</span>
                              )}
                              {client.is_new_client && (
                                <span className="text-xs text-primary font-medium">New</span>
                              )}
                              {client.is_service_only && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Service Only</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{client.email}</p>
                        <p className="text-sm text-gray-500">{client.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        {client.service_types.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {client.service_types.slice(0, 2).map(st => (
                              <span 
                                key={st.id}
                                className="px-2 py-0.5 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: st.color || '#8B7355' }}
                              >
                                {st.name.length > 12 ? st.name.slice(0, 12) + '...' : st.name}
                              </span>
                            ))}
                            {client.service_types.length > 2 && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                +{client.service_types.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {client.tax_return ? (
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: client.tax_return.status_color || '#8B7355' }}
                          >
                            {client.tax_return.status}
                          </span>
                        ) : client.is_service_only ? (
                          <span className="text-gray-400 text-sm">Service client</span>
                        ) : (
                          <span className="text-gray-400 text-sm">No return</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(client.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-secondary-dark">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  to={`/admin/clients/${client.id}`}
                  className="block p-4 hover:bg-secondary/30 hover:shadow-md transition-all rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      client.client_type === 'business' 
                        ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                        : 'bg-gradient-to-br from-primary-light to-primary'
                    }`}>
                      {client.client_type === 'business' ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : (
                        <span className="text-white font-semibold">
                          {client.full_name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {client.client_type === 'business' && client.business_name 
                              ? client.business_name 
                              : client.full_name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{client.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {client.is_service_only && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Service Only</span>
                          )}
                          {client.service_types.slice(0, 2).map(st => (
                            <span 
                              key={st.id}
                              className="px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: st.color || '#8B7355' }}
                            >
                              {st.name.length > 10 ? st.name.slice(0, 10) + '...' : st.name}
                            </span>
                          ))}
                          {client.tax_return && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: client.tax_return.status_color || '#8B7355' }}
                            >
                              {client.tax_return.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.total_pages > 1 && (
              <div className="px-6 py-4 border-t border-secondary-dark flex items-center justify-between bg-secondary/30">
                <p className="text-sm text-gray-600">
                  Showing {((meta.current_page - 1) * meta.per_page) + 1} to{' '}
                  {Math.min(meta.current_page * meta.per_page, meta.total_count)} of{' '}
                  {meta.total_count} clients
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 border border-secondary-dark rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= meta.total_pages}
                    className="px-4 py-2 border border-secondary-dark rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </FadeUp>
  )
}
