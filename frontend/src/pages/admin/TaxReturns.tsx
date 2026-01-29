import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'

// Define types locally to avoid Vite import caching issues
interface TaxReturnSummaryLocal {
  id: number
  tax_year: number
  client: {
    id: number
    full_name: string
    email: string
  }
  status: string
  status_slug: string
  status_color: string
  assigned_to: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

interface WorkflowStageLocal {
  id: number
  name: string
  slug: string
  position: number
  color: string | null
  notify_client: boolean
}

interface UserSummaryLocal {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  role: string
}

export default function TaxReturns() {
  useEffect(() => { document.title = 'Tax Returns | Cornerstone Admin' }, [])

  const [returns, setReturns] = useState<TaxReturnSummaryLocal[]>([])
  const [stages, setStages] = useState<WorkflowStageLocal[]>([])
  const [users, setUsers] = useState<UserSummaryLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Fetch tax returns with filters
  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true)
      const params: { page: number; search?: string; stage?: string; year?: number } = { page }
      if (search) params.search = search
      if (stageFilter) params.stage = stageFilter
      if (yearFilter) params.year = yearFilter

      const response = await api.getTaxReturns(params)
      if (response.data) {
        setReturns(response.data.tax_returns)
        setTotalPages(response.data.meta.total_pages)
        setTotalCount(response.data.meta.total_count)
      }
      setLoading(false)
    }

    const debounce = setTimeout(fetchReturns, 300)
    return () => clearTimeout(debounce)
  }, [search, stageFilter, yearFilter, page])

  // Fetch stages and users on mount
  useEffect(() => {
    const fetchData = async () => {
      const [stagesRes, usersRes] = await Promise.all([
        api.getWorkflowStages(),
        api.getUsers(),
      ])
      if (stagesRes.data) setStages(stagesRes.data.workflow_stages)
      if (usersRes.data) setUsers(usersRes.data.users)
    }
    fetchData()
  }, [])

  // Handle status change
  const handleStatusChange = async (returnId: number, newStageId: number) => {
    const response = await api.updateTaxReturn(returnId, { workflow_stage_id: newStageId })
    if (response.data) {
      setReturns(prev => prev.map(r => 
        r.id === returnId ? response.data!.tax_return : r
      ))
    }
  }

  // Handle assignment change
  const handleAssignmentChange = async (returnId: number, userId: number) => {
    if (!userId) return
    const response = await api.assignTaxReturn(returnId, userId)
    if (response.data) {
      setReturns(prev => prev.map(r => 
        r.id === returnId ? response.data!.tax_return : r
      ))
    }
  }

  // Generate year options (current year and previous 5 years)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tax Returns</h1>
          <p className="text-gray-500 mt-1">
            {totalCount} total return{totalCount !== 1 ? 's' : ''} • Manage status and assignments
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Client
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Client name..."
                className="w-full pl-10 pr-4 py-2.5 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-secondary/30"
              />
            </div>
          </div>

          {/* Stage Filter */}
          <div>
            <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="stage"
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPage(1) }}
              className="w-full px-4 py-2.5 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-secondary/30"
            >
              <option value="">All Statuses</option>
              {stages.map(stage => (
                <option key={stage.id} value={stage.slug}>{stage.name}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
              Tax Year
            </label>
            <select
              id="year"
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value ? parseInt(e.target.value) : ''); setPage(1) }}
              className="w-full px-4 py-2.5 border border-secondary-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-secondary/30"
            >
              <option value="">All Years</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => { setSearch(''); setStageFilter(''); setYearFilter(''); setPage(1) }}
              className="text-sm text-gray-600 hover:text-primary transition-colors font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-secondary-dark overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">No tax returns found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tax Year
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-dark">
                  {returns.map((taxReturn) => (
                    <tr key={taxReturn.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link 
                          to={`/admin/clients/${taxReturn.client.id}`}
                          className="group"
                        >
                          <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                            {taxReturn.client.full_name}
                          </p>
                          <p className="text-sm text-gray-500">{taxReturn.client.email}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{taxReturn.tax_year}</span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={stages.find(s => s.name === taxReturn.status)?.id || ''}
                          onChange={(e) => handleStatusChange(taxReturn.id, parseInt(e.target.value))}
                          className="text-sm font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer shadow-sm text-white"
                          style={{ backgroundColor: taxReturn.status_color || '#8B7355' }}
                          aria-label={`Status for ${taxReturn.client.full_name}`}
                        >
                          {stages.map(stage => (
                            <option key={stage.id} value={stage.id} className="text-gray-900 bg-white">
                              {stage.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={taxReturn.assigned_to?.id || ''}
                          onChange={(e) => handleAssignmentChange(taxReturn.id, parseInt(e.target.value))}
                          className="text-sm border border-secondary-dark rounded-lg px-3 py-1.5 bg-white hover:border-primary focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          aria-label={`Assigned to for ${taxReturn.client.full_name}`}
                        >
                          <option value="">Unassigned</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(taxReturn.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/returns/${taxReturn.id}`}
                          className="text-primary hover:text-primary-dark font-medium text-sm"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-secondary-dark">
              {returns.map((taxReturn) => (
                <div key={taxReturn.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <Link to={`/admin/clients/${taxReturn.client.id}`} className="min-w-0">
                      <p className="font-medium text-gray-900 hover:text-primary truncate">
                        {taxReturn.client.full_name}
                      </p>
                      <p className="text-sm text-gray-500">{taxReturn.tax_year} Tax Return</p>
                    </Link>
                    <span 
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: taxReturn.status_color || '#8B7355' }}
                    >
                      {taxReturn.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={stages.find(s => s.name === taxReturn.status)?.id || ''}
                      onChange={(e) => handleStatusChange(taxReturn.id, parseInt(e.target.value))}
                      className="text-sm border border-secondary-dark rounded-lg px-3 py-2 flex-1 min-w-[140px] bg-white"
                      aria-label={`Status for ${taxReturn.client.full_name}`}
                    >
                      {stages.map(stage => (
                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                      ))}
                    </select>
                    
                    <select
                      value={taxReturn.assigned_to?.id || ''}
                      onChange={(e) => handleAssignmentChange(taxReturn.id, parseInt(e.target.value))}
                      className="text-sm border border-secondary-dark rounded-lg px-3 py-2 flex-1 min-w-[140px] bg-white"
                      aria-label={`Assigned to for ${taxReturn.client.full_name}`}
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-400">
                      Created {formatDateTime(taxReturn.created_at)}
                    </p>
                    <Link
                      to={`/admin/returns/${taxReturn.id}`}
                      className="text-primary hover:text-primary-dark font-medium text-sm"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-secondary-dark flex items-center justify-between bg-secondary/30">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium border border-secondary-dark rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium border border-secondary-dark rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
