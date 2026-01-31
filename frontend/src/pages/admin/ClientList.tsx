import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'
import QuickCreateClientModal from '../../components/admin/QuickCreateClientModal'
import { FadeUp } from '../../components/ui/MotionComponents'

interface Client {
  id: number
  full_name: string
  email: string
  phone: string
  is_new_client: boolean
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
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadClients()
  }, [page, search])

  async function loadClients() {
    setLoading(true)
    try {
      const result = await api.getClients({ page, search, per_page: 20 })
      if (result.data) {
        setClients(result.data.clients)
        setMeta(result.data.meta)
      }
    } catch (error) {
      console.error('Failed to load clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadClients()
  }

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

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark p-5 sm:p-6">
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
              placeholder="Search by name or email..."
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
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Assigned To
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
                          <div className="w-11 h-11 bg-gradient-to-br from-primary-light to-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold">
                              {client.full_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                              {client.full_name}
                            </p>
                            {client.is_new_client && (
                              <span className="text-xs text-primary font-medium">New Client</span>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{client.email}</p>
                        <p className="text-sm text-gray-500">{client.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        {client.tax_return ? (
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: client.tax_return.status_color || '#8B7355' }}
                          >
                            {client.tax_return.status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">No return</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {client.tax_return?.assigned_to || '—'}
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
                    <div className="w-11 h-11 bg-gradient-to-br from-primary-light to-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">
                        {client.full_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{client.full_name}</p>
                          <p className="text-sm text-gray-500 truncate">{client.email}</p>
                        </div>
                        {client.tax_return && (
                          <span
                            className="self-start px-3 py-1 rounded-lg text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: client.tax_return.status_color || '#8B7355' }}
                          >
                            {client.tax_return.status}
                          </span>
                        )}
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
