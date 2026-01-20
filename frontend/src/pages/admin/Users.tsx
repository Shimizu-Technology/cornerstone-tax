import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/dateUtils'

// Define types locally to avoid Vite caching issues
interface AdminUser {
  id: number
  email: string
  role: 'admin' | 'employee'
  is_active: boolean
  is_pending: boolean
  created_at: string
  updated_at: string
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.getAdminUsers()
      if (response.data) {
        setUsers(response.data.users)
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInviting(true)

    try {
      const response = await api.inviteUser(inviteEmail, inviteRole)
      if (response.error) {
        setError(response.error)
      } else {
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole('employee')
        fetchUsers()
      }
    } catch (err) {
      setError('Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: 'admin' | 'employee') => {
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
    if (!confirm(`Are you sure you want to remove ${user.email}? They will no longer be able to access the system.`)) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark">User Management</h1>
          <p className="text-gray-600 mt-1">Invite and manage team members</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Invite User
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-secondary-dark overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-gray-500">No users yet</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="mt-4 text-primary hover:text-primary-dark font-medium"
            >
              Invite your first team member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 border-b border-secondary-dark">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-dark">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'employee')}
                        className="px-3 py-1.5 bg-secondary border border-secondary-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </select>
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
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
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
        {!loading && users.map((user) => (
          <div key={user.id} className="bg-white rounded-2xl border border-secondary-dark p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 break-all">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    Joined {formatDateTime(user.created_at)}
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
            <div className="mt-4 flex items-center justify-between gap-4">
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'employee')}
                className="flex-1 px-3 py-2 bg-secondary border border-secondary-dark rounded-lg text-sm"
              >
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
              </select>
              <button
                onClick={() => handleDelete(user)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-primary-dark">Invite User</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setError('')
                  setInviteEmail('')
                  setInviteRole('employee')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
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
                    setError('')
                    setInviteEmail('')
                    setInviteRole('employee')
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
  )
}
