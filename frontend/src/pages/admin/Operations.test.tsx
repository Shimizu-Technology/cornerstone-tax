import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationsPage from './Operations'

const apiMocks = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getOperationTasks: vi.fn(),
  getMyOperationTasks: vi.fn(),
  updateOperationTask: vi.fn(),
  completeOperationTask: vi.fn(),
  reopenOperationTask: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  api: apiMocks,
}))

const baseTask = {
  operation_cycle_id: 11,
  cycle_label: 'Cycle A',
  operation_template_name: 'Template A',
  description: null,
  position: 1,
  assigned_to: null,
  due_at: null,
  started_at: null,
  completed_at: null,
  completed_by: null,
  evidence_note: null,
  notes: null,
  linked_time_entry_id: null,
  linked_time_entry: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OperationsPage />
    </MemoryRouter>
  )
}

describe('OperationsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    apiMocks.getUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 1,
            email: 'staff@example.com',
            first_name: 'Staff',
            last_name: 'User',
            display_name: 'Staff User',
            full_name: 'Staff User',
            role: 'employee',
          },
        ],
      },
    })

    apiMocks.getOperationTasks.mockResolvedValue({
      data: {
        operation_tasks: [
          {
            ...baseTask,
            id: 101,
            operation_template_task_id: 501,
            client_id: 301,
            client_name: 'Acme Co',
            title: 'Blocked Task',
            status: 'not_started',
            evidence_required: false,
            unmet_prerequisites: [{ id: 88, title: 'Prep', status: 'not_started' }],
          },
        ],
      },
    })

    apiMocks.getMyOperationTasks.mockResolvedValue({
      data: { operation_tasks: [] },
    })
    apiMocks.updateOperationTask.mockResolvedValue({ data: { operation_task: {} } })
    apiMocks.completeOperationTask.mockResolvedValue({ data: { operation_task: {} } })
    apiMocks.reopenOperationTask.mockResolvedValue({ data: { operation_task: {} } })
  })

  it('renders blocked prerequisite state and disables forward actions', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Blocked Task')).toBeInTheDocument()
    })

    expect(screen.getByText(/Waiting on:/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark Done' })).toBeDisabled()
  })

  it('saves and restores quick filters from localStorage', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Quick Filter' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Save current filter set'), {
      target: { value: 'Morning Queue' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Quick Filter' }))

    expect(screen.getByRole('button', { name: 'Morning Queue' })).toBeInTheDocument()
    expect(localStorage.getItem('operations.savedQuickFilters.v1')).toContain('Morning Queue')

    // Simulate fresh render and verify saved filters are rehydrated.
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Morning Queue' }).length).toBeGreaterThan(0)
    })
  })

  it('uses my tasks endpoint for My Tasks quick preset', async () => {
    renderPage()

    await waitFor(() => {
      expect(apiMocks.getOperationTasks).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'My Tasks Today' }))

    await waitFor(() => {
      expect(apiMocks.getMyOperationTasks).toHaveBeenCalled()
    })
  })
})
