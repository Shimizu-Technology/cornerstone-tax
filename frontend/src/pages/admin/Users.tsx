import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import type { AdminUser } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'
import { FadeUp } from '../../components/ui/MotionComponents'

type Tab = 'team' | 'clients'

export default function Users() {
  useEffect(() => { document.title = 'Users | Cornerstone Admin' }, [])

  const [activeTab, setActiveTab] = useState<Tab>('team')
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [resendingId, setResendingId] = useState<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showInviteModal && modalRef.current) {
      const firstInput = modalRef.current.querySelector<HTMLElement>('input, select, textarea')
      if (firstInput) setTimeout(() => firstInput.focus(), 0)
    }
  }, [showInviteModal])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.getAdminUsers()
      if (response.data) {
        setAllUsers(response.data.users)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const teamUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'employee')
  const clientUsers = allUsers.filter(u => u.role === 'client')

  const resetInviteForm = () => {
    setInviteFirstName('')
    setInviteLastName('')
    setInviteEmail('')
    setInviteRole('employee')
    setError('')
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInviting(true)

    try {
      const response = await api.inviteUser({
        email: inviteEmail,
        first_name: inviteFirstName,
        last_name: inviteLastName || undefined,
        role: inviteRole
      })
      if (response.error) {
        setError(response.error)
      } else {
        setShowInviteModal(false)
        resetInviteForm()
        fetchUsers()
      }
    } catch (err) {
      setError('Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: 'admin' | 'employee' | 'client') => {
    try {
      const response = await api.updateUserRole(userId, newRole)
      if (response.error) {
        alert(response.error)
      } else {
        fetchUsers()
      }
    } catch (err) {
      alert('Failed to update role')
    }
  }

  const handleDelete = async (user: AdminUser) => {
    const label = user.role === 'client' ? 'client portal user' : 'team member'
    if (!confirm(`Are you sure you want to remove ${user.display_name || user.email}? They will no longer be able to access the system as a ${label}.`)) {
      return
    }

    try {
      const response = await api.deleteUser(user.id)
      if (response.error) {
        alert(response.error)
      } else {
        fetchUsers()
      }
    } catch (err) {
      alert('Failed to delete user')
    }
  }

  const handleResendInvite = async (user: AdminUser) => {
    setResendingId(user.id)
    try {
      const response = await api.resendInvite(user.id)
      if (response.error) {
        alert(response.error)
      } else {
        alert(`Invitation re-sent to ${user.email}`)
      }
    } catch (err) {
      alert('Failed to resend invite')
    } finally {
      setResendingId(null)
    }
  }

  const displayUsers = activeTab === 'team' ? teamUsers : clientUsers

  return (
    <FadeUp>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark tracking-tight">User Management</h1>
          <p className="text-gray-600 mt-1">
            {activeTab === 'team' ? 'Invite and manage team members' : 'Manage client portal access'}
          </p>
        </div>
        {activeTab === 'team' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Team Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'team'
              ? 'bg-white text-primary-dark shadow-sm'
              : 'text-gray-600 hover:text-primary-dark'
          }`}
        >
          Team
          <span className="ml-1.5 text-xs text-gray-400">({teamUsers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'clients'
              ? 'bg-white text-primary-dark shadow-sm'
              : 'text-gray-600 hover:text-primary-dark'
          }`}
        >
          Clients
          <span className="ml-1.5 text-xs text-gray-400">({clientUsers.length})</span>
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-secondary-dark overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading users...</p>
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">{activeTab === 'team' ? '👥' : '🏢'}</div>
            <p className="text-gray-500">
              {activeTab === 'team' ? 'No team members yet' : 'No client portal users yet'}
            </p>
            {activeTab === 'team' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 text-primary hover:text-primary-dark font-medium"
              >
                Invite your first team member
              </button>
            )}
            {activeTab === 'clients' && (
              <p className="mt-2 text-sm text-gray-400">
                Client portal invites are sent from individual client detail pages
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 border-b border-secondary-dark">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  {activeTab === 'clients' && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Linked Client
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {activeTab === 'clients' ? 'Invited' : 'Joined'}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-dark">
                {displayUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          user.role === 'client' ? 'bg-blue-50' : 'bg-primary/10'
                        }`}>
                          <span className={`font-medium ${
                            user.role === 'client' ? 'text-blue-600' : 'text-primary'
                          }`}>
                            {(user.first_name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.display_name || user.email.split('@')[0]}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    {activeTab === 'clients' && (
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {user.client_name || <span className="text-gray-400 italic">No linked client</span>}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {activeTab === 'team' ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'employee')}
                          className="px-3 py-1.5 bg-secondary border border-secondary-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          aria-label={`Role for ${user.display_name || user.email}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="employee">Employee</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Client
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_pending ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.is_pending && (
                          <button
                            onClick={() => handleResendInvite(user)}
                            disabled={resendingId === user.id}
                            className="text-primary hover:text-primary-dark text-sm font-medium disabled:opacity-50"
                          >
                            {resendingId === user.id ? 'Sending...' : 'Resend Invite'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-4">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading users...</p>
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-secondary-dark p-8 text-center">
            <div className="text-4xl mb-2">{activeTab === 'team' ? '👥' : '🏢'}</div>
            <p className="text-gray-500">
              {activeTab === 'team' ? 'No team members yet' : 'No client portal users yet'}
            </p>
            {activeTab === 'team' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 text-primary hover:text-primary-dark font-medium"
              >
                Invite your first team member
              </button>
            )}
            {activeTab === 'clients' && (
              <p className="mt-2 text-sm text-gray-400">
                Client portal invites are sent from individual client detail pages
              </p>
            )}
          </div>
        ) : displayUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-2xl border border-secondary-dark p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  user.role === 'client' ? 'bg-blue-50' : 'bg-primary/10'
                }`}>
                  <span className={`font-medium ${
                    user.role === 'client' ? 'text-blue-600' : 'text-primary'
                  }`}>
                    {(user.first_name || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.display_name || user.email.split('@')[0]}</p>
                  <p className="text-sm text-gray-500 break-all">{user.email}</p>
                  {activeTab === 'clients' && user.client_name && (
                    <p className="text-xs text-blue-600 mt-0.5">Client: {user.client_name}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {activeTab === 'clients' ? 'Invited' : 'Joined'} {formatDateTime(user.created_at)}
                  </p>
                </div>
              </div>
              {user.is_pending ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              {activeTab === 'team' ? (
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'employee')}
                  className="flex-1 px-3 py-2 bg-secondary border border-secondary-dark rounded-lg text-sm"
                  aria-label={`Role for ${user.display_name || user.email}`}
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                </select>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Client
                </span>
              )}
              <div className="flex items-center gap-2">
                {user.is_pending && (
                  <button
                    onClick={() => handleResendInvite(user)}
                    disabled={resendingId === user.id}
                    className="px-3 py-2 text-primary hover:bg-primary/5 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {resendingId === user.id ? 'Sending...' : 'Resend'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(user)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowInviteModal(false); resetInviteForm() }}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowInviteModal(false)
                resetInviteForm()
              }
              if (e.key === 'Tab') {
                const modal = e.currentTarget
                const focusable = modal.querySelectorAll<HTMLElement>(
                  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                if (e.shiftKey) {
                  if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                  }
                } else {
                  if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                  }
                }
              }
            }}
            ref={modalRef}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="invite-modal-title" className="text-xl font-bold text-primary-dark">Invite Team Member</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  resetInviteForm()
                }}
                aria-label="Close" className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="John"
                    required
                    className="w-full px-4 py-3 bg-secondary border border-secondary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    id="invite-last-name"
                    type="text"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 bg-secondary border border-secondary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="employee@example.com"
                  required
                  className="w-full px-4 py-3 bg-secondary border border-secondary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  They'll be able to sign up using this email
                </p>
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'employee')}
                  className="w-full px-4 py-3 bg-secondary border border-secondary-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Admins can manage users and settings
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false)
                    resetInviteForm()
                  }}
                  className="flex-1 px-4 py-3 border border-secondary-dark rounded-xl text-gray-700 hover:bg-secondary transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </FadeUp>
  )
}
