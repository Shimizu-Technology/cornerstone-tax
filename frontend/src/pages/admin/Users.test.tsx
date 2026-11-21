import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Users from './Users'

const apiMocks = vi.hoisted(() => ({
  getAdminUsers: vi.fn(),
  inviteUser: vi.fn(),
  updateUserRole: vi.fn(),
  setUserFlexibleHours: vi.fn(),
  terminateUser: vi.fn(),
  reactivateUser: vi.fn(),
  resendInvite: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: apiMocks }))
vi.mock('../../components/ui/MotionComponents', () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const activeUser = {
  id: 1,
  email: 'dafne@example.com',
  first_name: 'Dafne',
  last_name: 'Owner',
  display_name: 'Dafne',
  full_name: 'Dafne Owner',
  role: 'admin' as const,
  client_id: null,
  client_name: null,
  is_active: true,
  is_pending: false,
  employment_status: 'active' as const,
  termination_effective_on: null,
  terminated_at: null,
  termination_reason: null,
  terminated_by: null,
  time_entries_count: 0,
  schedules_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const terminatedUser = {
  ...activeUser,
  id: 2,
  email: 'daena@example.com',
  first_name: 'Daena',
  last_name: 'Mansapit',
  display_name: 'Daena',
  full_name: 'Daena Mansapit',
  role: 'employee' as const,
  is_active: false,
  employment_status: 'terminated' as const,
  termination_effective_on: null,
  terminated_at: '2026-09-21T00:00:00Z',
  termination_reason: 'Recovered legacy profile',
  terminated_by: null,
  time_entries_count: 152,
  schedules_count: 22,
}

const activeEmployee = {
  ...activeUser,
  id: 3,
  email: 'kami@example.com',
  first_name: 'Kami',
  last_name: 'Employee',
  display_name: 'Kami',
  full_name: 'Kami Employee',
  role: 'employee' as const,
}

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getAdminUsers.mockResolvedValue({ data: { users: [activeUser, activeEmployee, terminatedUser] } })
    apiMocks.getCurrentUser.mockResolvedValue({ data: { user: { id: activeUser.id } } })
    apiMocks.terminateUser.mockResolvedValue({ data: { user: terminatedUser } })
    apiMocks.reactivateUser.mockResolvedValue({ data: { user: activeUser } })
    apiMocks.resendInvite.mockResolvedValue({ data: { message: 'sent' } })
    apiMocks.updateUserRole.mockResolvedValue({ data: { user: activeUser } })
    apiMocks.inviteUser.mockResolvedValue({ data: { user: activeUser } })
  })

  it('keeps terminated employees visible with retained history', async () => {
    render(<Users />)

    await screen.findAllByText('Dafne Owner')
    fireEvent.click(screen.getByRole('button', { name: /terminated \(1\)/i }))

    expect((await screen.findAllByText('Daena Mansapit')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('152 time entries · 22 shifts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Terminated').length).toBeGreaterThan(0)
  })

  it('explains history preservation before terminating an active employee', async () => {
    render(<Users />)

    await screen.findAllByText('Dafne Owner')
    fireEvent.click(screen.getAllByRole('button', { name: 'Terminate' })[0])

    expect(screen.getByText(/Access ends immediately/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /End access, keep history/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Employment ended' } })
    fireEvent.click(screen.getByRole('button', { name: /End access, keep history/i }))

    await waitFor(() => expect(apiMocks.terminateUser).toHaveBeenCalledWith(3, expect.objectContaining({ termination_reason: 'Employment ended' })))
  })

  it('shows termination failures inside the active dialog', async () => {
    apiMocks.terminateUser.mockResolvedValueOnce({ error: 'Lifecycle update failed' })
    render(<Users />)

    await screen.findAllByText('Dafne Owner')
    fireEvent.click(screen.getAllByRole('button', { name: 'Terminate' })[0])
    fireEvent.click(screen.getByRole('button', { name: /End access, keep history/i }))

    const dialog = screen.getByRole('dialog', { name: /Terminate Kami Employee/i })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Lifecycle update failed')
  })

  it('keeps role and lifecycle controls unavailable until the signed-in user is known', async () => {
    apiMocks.getCurrentUser.mockReturnValueOnce(new Promise(() => {}))
    render(<Users />)

    await screen.findAllByText('Dafne Owner')
    expect(screen.getAllByText('Checking access…')).toHaveLength(4)
    expect(screen.getByRole('combobox', { name: 'Role for Kami Employee' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument()
  })

  it('lets an admin switch flexible hours for a team member', async () => {
    apiMocks.setUserFlexibleHours.mockResolvedValue({ data: { user: { ...activeEmployee, flexible_hours: true } } })
    render(<Users />)

    const [toggle] = await screen.findAllByRole('switch', { name: 'Flexible hours for Kami Employee' })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)

    await waitFor(() => expect(apiMocks.setUserFlexibleHours).toHaveBeenCalledWith(3, true))
    await waitFor(() => expect(screen.getAllByRole('switch', { name: 'Flexible hours for Kami Employee' })[0]).toBeChecked())
    expect(screen.getAllByText('Clock-ins without a shift skip approval').length).toBeGreaterThan(0)
    // Terminated people have no switch.
    expect(screen.queryByRole('switch', { name: 'Flexible hours for Daena Mansapit' })).not.toBeInTheDocument()
  })

  it('holds the role control while a flexible-hours change is saving, and keeps the newer row data', async () => {
    let resolve: (value: unknown) => void = () => {}
    apiMocks.setUserFlexibleHours.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<Users />)

    const [toggle] = await screen.findAllByRole('switch', { name: 'Flexible hours for Kami Employee' })
    await waitFor(() => expect(toggle).toBeEnabled())
    fireEvent.click(toggle)

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Kami Employee' })).toBeDisabled())
    // The response carries an older snapshot of the row (role admin).
    resolve({ data: { user: { ...activeEmployee, role: 'admin', flexible_hours: true } } })

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Kami Employee' })).toBeEnabled())
    expect((screen.getByRole('combobox', { name: 'Role for Kami Employee' }) as HTMLSelectElement).value).toBe('employee')
    expect(screen.getAllByRole('switch', { name: 'Flexible hours for Kami Employee' })[0]).toBeChecked()
  })

  it('holds the flexible-hours switch while a role change is saving', async () => {
    let resolve: (value: unknown) => void = () => {}
    apiMocks.updateUserRole.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<Users />)

    const role = await screen.findByRole('combobox', { name: 'Role for Kami Employee' })
    await waitFor(() => expect(role).toBeEnabled())
    fireEvent.change(role, { target: { value: 'admin' } })

    // Disabled in both layouts (table and phone card); a browser sends no
    // events from a disabled control.
    await waitFor(() => screen.getAllByRole('switch', { name: 'Flexible hours for Kami Employee' }).forEach((toggle) => expect(toggle).toBeDisabled()))

    resolve({ data: { user: { ...activeEmployee, role: 'admin' } } })
    await waitFor(() => screen.getAllByRole('switch', { name: 'Flexible hours for Kami Employee' }).forEach((toggle) => expect(toggle).toBeEnabled()))
  })

  it('holds the role control while a flexible-hours change is saving, and frees it after', async () => {
    let resolve: (value: unknown) => void = () => {}
    apiMocks.setUserFlexibleHours.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<Users />)

    const [toggle] = await screen.findAllByRole('switch', { name: 'Flexible hours for Kami Employee' })
    await waitFor(() => expect(toggle).toBeEnabled())
    fireEvent.click(toggle)

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Kami Employee' })).toBeDisabled())

    resolve({ data: { user: { ...activeEmployee, flexible_hours: true } } })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Kami Employee' })).toBeEnabled())
  })
})
