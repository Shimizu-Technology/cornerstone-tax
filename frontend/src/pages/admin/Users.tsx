import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FadeUp } from '../../components/ui/MotionComponents'
import { api } from '../../lib/api'
import type { AdminUser } from '../../lib/api'
import { formatDateISO } from '../../lib/dateUtils'

type Tab = 'team' | 'clients'
type TeamView = 'active' | 'terminated'

function UserStatusBadge({ user }: { user: AdminUser }) {
  if (user.employment_status === 'terminated') {
    return <span className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">Terminated</span>
  }
  if (user.is_pending) {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Invite pending</span>
  }
  return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Active</span>
}

function HistorySummary({ user }: { user: AdminUser }) {
  return (
    <span className="text-xs text-gray-500">
      {user.time_entries_count} time {user.time_entries_count === 1 ? 'entry' : 'entries'} · {user.schedules_count} {user.schedules_count === 1 ? 'shift' : 'shifts'}
    </span>
  )
}

function focusableElements(container: HTMLElement) {
  return container.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
}

export default function Users() {
  useEffect(() => { document.title = 'Users | Cornerstone Admin' }, [])

  const [activeTab, setActiveTab] = useState<Tab>('team')
  const [teamView, setTeamView] = useState<TeamView>('active')
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [terminationTarget, setTerminationTarget] = useState<AdminUser | null>(null)
  const [terminationEffectiveOn, setTerminationEffectiveOn] = useState(formatDateISO(new Date()))
  const [terminationReason, setTerminationReason] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [inviting, setInviting] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [updatingRoleIds, setUpdatingRoleIds] = useState<Set<number>>(new Set())
  const inviteModalRef = useRef<HTMLDivElement>(null)
  const terminationModalRef = useRef<HTMLDivElement>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setPageError('')
    const response = await api.getAdminUsers()
    if (response.data) setAllUsers(response.data.users)
    else setPageError(response.error || 'Unable to load users')
    setLoading(false)
  }, [])

  useEffect(() => { void fetchUsers() }, [fetchUsers])
  useEffect(() => {
    void api.getCurrentUser().then(response => {
      if (response.data) setCurrentUserId(response.data.user.id)
    })
  }, [])

  useEffect(() => {
    const modal = terminationTarget ? terminationModalRef.current : showInviteModal ? inviteModalRef.current : null
    if (!modal) return
    window.setTimeout(() => focusableElements(modal)[0]?.focus(), 0)
  }, [showInviteModal, terminationTarget])

  const teamUsers = useMemo(() => allUsers.filter(user => user.role === 'admin' || user.role === 'employee'), [allUsers])
  const clientUsers = useMemo(() => allUsers.filter(user => user.role === 'client'), [allUsers])
  const activeTeam = teamUsers.filter(user => user.employment_status === 'active')
  const terminatedTeam = teamUsers.filter(user => user.employment_status === 'terminated')
  const visibleTeam = teamView === 'active' ? activeTeam : terminatedTeam

  const withPending = async (userId: number, action: () => Promise<void>) => {
    setPendingIds(previous => new Set(previous).add(userId))
    try {
      await action()
    } finally {
      setPendingIds(previous => {
        const next = new Set(previous)
        next.delete(userId)
        return next
      })
    }
  }

  const resetInvite = () => {
    setInviteFirstName('')
    setInviteLastName('')
    setInviteEmail('')
    setInviteRole('employee')
    setPageError('')
  }

  const closeInvite = () => {
    setShowInviteModal(false)
    resetInvite()
  }

  const closeTermination = () => {
    setTerminationTarget(null)
    setTerminationEffectiveOn(formatDateISO(new Date()))
    setTerminationReason('')
    setPageError('')
  }

  const trapDialogFocus = (event: React.KeyboardEvent<HTMLDivElement>, close: () => void) => {
    if (event.key === 'Escape') close()
    if (event.key !== 'Tab') return
    const focusable = focusableElements(event.currentTarget)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setInviting(true)
    setPageError('')
    const response = await api.inviteUser({
      email: inviteEmail,
      first_name: inviteFirstName,
      last_name: inviteLastName || undefined,
      role: inviteRole,
    })
    setInviting(false)
    if (response.error) return setPageError(response.error)
    closeInvite()
    await fetchUsers()
  }

  const handleRoleChange = async (user: AdminUser, role: 'admin' | 'employee') => {
    setUpdatingRoleIds(previous => new Set(previous).add(user.id))
    const response = await api.updateUserRole(user.id, role)
    setUpdatingRoleIds(previous => {
      const next = new Set(previous)
      next.delete(user.id)
      return next
    })
    if (response.error) return setPageError(response.error)
    await fetchUsers()
  }

  const handleTerminate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!terminationTarget) return
    const target = terminationTarget
    await withPending(target.id, async () => {
      const response = await api.terminateUser(target.id, {
        termination_effective_on: terminationEffectiveOn || undefined,
        termination_reason: terminationReason.trim() || undefined,
      })
      if (response.error) return setPageError(response.error)
      closeTermination()
      setTeamView('terminated')
      await fetchUsers()
    })
  }

  const handleReactivate = async (user: AdminUser) => {
    if (!window.confirm(`Reactivate ${user.full_name || user.email}? They will regain access with their existing sign-in.`)) return
    await withPending(user.id, async () => {
      const response = await api.reactivateUser(user.id)
      if (response.error) return setPageError(response.error)
      setTeamView('active')
      await fetchUsers()
    })
  }

  const handleResendInvite = async (user: AdminUser) => {
    await withPending(user.id, async () => {
      const response = await api.resendInvite(user.id)
      if (response.error) setPageError(response.error)
    })
  }

  const rowActions = (user: AdminUser) => {
    const busy = pendingIds.has(user.id)
    if (user.id === currentUserId) {
      return <span className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-gray-500">Signed in as you</span>
    }
    if (user.employment_status === 'terminated') {
      return (
        <button onClick={() => void handleReactivate(user)} disabled={busy} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
          {busy ? 'Reactivating…' : 'Reactivate'}
        </button>
      )
    }
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        {user.is_pending && (
          <button onClick={() => void handleResendInvite(user)} disabled={busy} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">
            {busy ? 'Sending…' : 'Resend invite'}
          </button>
        )}
        <button onClick={() => setTerminationTarget(user)} disabled={busy} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
          {user.role === 'client' ? 'Deactivate' : 'Terminate'}
        </button>
      </div>
    )
  }

  const userTable = (users: AdminUser[], isTeam: boolean) => (
    <div className="overflow-hidden rounded-2xl border border-secondary-dark bg-white shadow-sm">
      {loading ? (
        <div className="p-10 text-center text-sm text-gray-500" role="status">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-1-12a4 4 0 010 7.75" /></svg>
          </div>
          <p className="font-medium text-primary-dark">{isTeam && teamView === 'terminated' ? 'No terminated team members' : 'No users in this view'}</p>
          <p className="mt-1 text-sm text-gray-500">Historical profiles will remain here after access is ended.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead className="border-b border-secondary-dark bg-secondary/50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr><th className="px-6 py-4">Person</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">History</th><th className="px-6 py-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-secondary-dark">
                {users.map(user => (
                  <tr key={user.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-6 py-4"><p className="font-semibold text-gray-900">{user.full_name || user.email}</p><p className="text-sm text-gray-500">{user.email}</p></td>
                    <td className="px-6 py-4">
                      {isTeam && user.employment_status === 'active' ? (
                        <select value={user.role} onChange={event => void handleRoleChange(user, event.target.value as 'admin' | 'employee')} disabled={updatingRoleIds.has(user.id) || user.id === currentUserId} className="min-h-11 rounded-lg border border-secondary-dark bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" aria-label={`Role for ${user.full_name || user.email}`}><option value="admin">Admin</option><option value="employee">Employee</option></select>
                      ) : <span className="text-sm capitalize text-gray-700">{user.role}</span>}
                    </td>
                    <td className="px-6 py-4"><UserStatusBadge user={user} />{user.termination_effective_on && <p className="mt-1 text-xs text-gray-500">Effective {user.termination_effective_on}</p>}</td>
                    <td className="px-6 py-4"><HistorySummary user={user} /></td>
                    <td className="px-6 py-4 text-right">{rowActions(user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-secondary-dark sm:hidden">
            {users.map(user => (
              <article key={user.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{user.full_name || user.email}</p><p className="break-all text-sm text-gray-500">{user.email}</p></div><UserStatusBadge user={user} /></div>
                <HistorySummary user={user} />
                <div className="flex items-center justify-between gap-3"><span className="text-sm capitalize text-gray-700">{user.role}</span>{rowActions(user)}</div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <FadeUp>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Access & history</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">User Management</h1><p className="mt-1 max-w-2xl text-gray-600">End access without erasing payroll, schedule, approval, or audit history.</p></div>
          {activeTab === 'team' && <button onClick={() => setShowInviteModal(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-dark"><span aria-hidden="true">+</span> Invite team member</button>}
        </header>

        {pageError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{pageError}</div>}

        <div className="grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3">
          <div className="rounded-xl border border-secondary-dark bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active team</p><p className="mt-1 text-2xl font-bold text-primary-dark">{activeTeam.length}</p></div>
          <div className="rounded-xl border border-secondary-dark bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Terminated</p><p className="mt-1 text-2xl font-bold text-primary-dark">{terminatedTeam.length}</p></div>
          <div className="col-span-2 rounded-xl border border-secondary-dark bg-white p-4 sm:col-span-1"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Portal users</p><p className="mt-1 text-2xl font-bold text-primary-dark">{clientUsers.length}</p></div>
        </div>

        <div role="tablist" aria-label="User type" className="flex w-fit gap-1 rounded-xl bg-secondary/60 p-1">
          {(['team', 'clients'] as const).map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-600 hover:text-primary-dark'}`}>{tab === 'team' ? `Team (${teamUsers.length})` : `Clients (${clientUsers.length})`}</button>)}
        </div>

        {activeTab === 'team' ? (
          <section aria-label="Team members" className="space-y-4">
            <div className="flex items-center gap-5 border-b border-secondary-dark">
              {(['active', 'terminated'] as const).map(view => <button key={view} onClick={() => setTeamView(view)} className={`min-h-11 border-b-2 px-1 text-sm font-semibold capitalize ${teamView === view ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary-dark'}`}>{view} ({view === 'active' ? activeTeam.length : terminatedTeam.length})</button>)}
            </div>
            {userTable(visibleTeam, true)}
          </section>
        ) : userTable(clientUsers, false)}

        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeInvite() }}>
            <div ref={inviteModalRef} role="dialog" aria-modal="true" aria-labelledby="invite-title" onKeyDown={event => trapDialogFocus(event, closeInvite)} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4"><div><h2 id="invite-title" className="text-xl font-bold text-primary-dark">Invite team member</h2><p className="mt-1 text-sm text-gray-600">Their account becomes active after they accept the invite.</p></div><button onClick={closeInvite} aria-label="Close invite dialog" className="min-h-11 min-w-11 rounded-lg text-gray-500 hover:bg-secondary">×</button></div>
              <form onSubmit={event => void handleInvite(event)} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-gray-700">First name<input autoComplete="given-name" required value={inviteFirstName} onChange={event => setInviteFirstName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-secondary-dark bg-secondary px-3 focus:outline-none focus:ring-2 focus:ring-primary/30" /></label><label className="text-sm font-medium text-gray-700">Last name<input autoComplete="family-name" value={inviteLastName} onChange={event => setInviteLastName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-secondary-dark bg-secondary px-3 focus:outline-none focus:ring-2 focus:ring-primary/30" /></label></div>
                <label className="block text-sm font-medium text-gray-700">Email<input type="email" autoComplete="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-secondary-dark bg-secondary px-3 focus:outline-none focus:ring-2 focus:ring-primary/30" /></label>
                <label className="block text-sm font-medium text-gray-700">Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as 'admin' | 'employee')} className="mt-1 min-h-11 w-full rounded-xl border border-secondary-dark bg-secondary px-3 focus:outline-none focus:ring-2 focus:ring-primary/30"><option value="employee">Employee</option><option value="admin">Admin</option></select></label>
                <div className="flex gap-3 pt-2"><button type="button" onClick={closeInvite} className="min-h-11 flex-1 rounded-xl border border-secondary-dark font-semibold text-gray-700 hover:bg-secondary">Cancel</button><button type="submit" disabled={inviting} className="min-h-11 flex-1 rounded-xl bg-primary font-semibold text-white hover:bg-primary-dark disabled:opacity-50">{inviting ? 'Sending…' : 'Send invite'}</button></div>
              </form>
            </div>
          </div>
        )}

        {terminationTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeTermination() }}>
            <div ref={terminationModalRef} role="dialog" aria-modal="true" aria-labelledby="termination-title" onKeyDown={event => trapDialogFocus(event, closeTermination)} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-700">Preserve history</p><h2 id="termination-title" className="mt-1 text-xl font-bold text-primary-dark">{terminationTarget.role === 'client' ? 'Deactivate' : 'Terminate'} {terminationTarget.full_name || terminationTarget.email}</h2></div><button onClick={closeTermination} aria-label="Close termination dialog" className="min-h-11 min-w-11 rounded-lg text-gray-500 hover:bg-secondary">×</button></div>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Access ends immediately. The profile and all {terminationTarget.time_entries_count} time entries, {terminationTarget.schedules_count} shifts, approvals, and report history stay intact.</div>
              <form onSubmit={event => void handleTerminate(event)} className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-gray-700">Effective date <span className="font-normal text-gray-500">(optional)</span><input type="date" value={terminationEffectiveOn} onChange={event => setTerminationEffectiveOn(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-secondary-dark px-3 focus:outline-none focus:ring-2 focus:ring-primary/30" /><span className="mt-1 block text-xs font-normal text-gray-500">Clear this if the authoritative date is unknown.</span></label>
                <label className="block text-sm font-medium text-gray-700">Reason <span className="font-normal text-gray-500">(optional, internal)</span><textarea rows={3} maxLength={2000} value={terminationReason} onChange={event => setTerminationReason(event.target.value)} className="mt-1 w-full rounded-xl border border-secondary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" /></label>
                <div className="flex gap-3 pt-2"><button type="button" onClick={closeTermination} className="min-h-11 flex-1 rounded-xl border border-secondary-dark font-semibold text-gray-700 hover:bg-secondary">Cancel</button><button type="submit" disabled={pendingIds.has(terminationTarget.id)} className="min-h-11 flex-1 rounded-xl bg-red-700 font-semibold text-white hover:bg-red-800 disabled:opacity-50">{pendingIds.has(terminationTarget.id) ? 'Saving…' : 'End access, keep history'}</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FadeUp>
  )
}
