import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationsPage from './Operations'

const apiMocks = vi.hoisted(() => ({
  getPayrollChecklistBoard: vi.fn(),
  getPayrollChecklistPeriod: vi.fn(),
  createPayrollChecklistPeriod: vi.fn(),
  togglePayrollChecklistItem: vi.fn(),
  updatePayrollChecklistItem: vi.fn(),
  completePayrollChecklistPeriod: vi.fn(),
  reopenPayrollChecklistPeriod: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  api: apiMocks,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <OperationsPage />
    </MemoryRouter>
  )
}

describe('OperationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    apiMocks.getPayrollChecklistBoard.mockResolvedValue({
      data: {
        periods: [
          {
            start: '2026-02-01',
            end: '2026-02-14',
            label: 'Feb 1–14',
          },
        ],
        rows: [
          {
            client_id: 301,
            client_name: 'Acme Co',
            cells: [
              {
                period_start: '2026-02-01',
                period_end: '2026-02-14',
                checklist_period_id: 101,
                done_count: 1,
                total_count: 3,
                status: 'open',
              },
            ],
          },
        ],
      },
    })

    apiMocks.getPayrollChecklistPeriod.mockResolvedValue({
      data: {
        period: {
          id: 101,
          client_id: 301,
          client_name: 'Acme Co',
          start: '2026-02-01',
          end: '2026-02-14',
          pay_date: null,
          status: 'open',
          done_count: 1,
          total_count: 3,
        },
        items: [
          {
            id: 9001,
            key: 'get_hours',
            label: 'Get hours from client',
            position: 1,
            required: true,
            done: false,
            completed_at: null,
            completed_by: null,
            note: '',
            proof_url: null,
          },
        ],
      },
    })

    apiMocks.togglePayrollChecklistItem.mockResolvedValue({ data: { item: {} } })
    apiMocks.updatePayrollChecklistItem.mockResolvedValue({ data: { item: {} } })
    apiMocks.createPayrollChecklistPeriod.mockResolvedValue({ data: { period: { id: 102 } } })
    apiMocks.completePayrollChecklistPeriod.mockResolvedValue({ data: { period: { id: 101, status: 'completed' } } })
    apiMocks.reopenPayrollChecklistPeriod.mockResolvedValue({ data: { period: { id: 101, status: 'open' } } })
  })

  it('renders board with client rows and period cells', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Acme Co')).toBeInTheDocument()
    })
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('opens period drawer and shows checklist steps', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('1/3')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('1/3'))
    await waitFor(() => {
      expect(apiMocks.getPayrollChecklistPeriod).toHaveBeenCalledWith(101)
      expect(screen.getByText(/Get hours from client/i)).toBeInTheDocument()
    })
  })

  it('auto-creates a period when clicking an empty cell', async () => {
    apiMocks.getPayrollChecklistBoard
      .mockResolvedValueOnce({
        data: {
          periods: [
            {
              start: '2026-02-01',
              end: '2026-02-14',
              label: 'Feb 1–14',
            },
          ],
          rows: [
            {
              client_id: 301,
              client_name: 'Acme Co',
              cells: [
                {
                  period_start: '2026-02-01',
                  period_end: '2026-02-14',
                  checklist_period_id: null,
                  done_count: 0,
                  total_count: 3,
                  status: 'open',
                },
              ],
            },
          ],
        },
      })
      .mockResolvedValue({
        data: {
          periods: [
            {
              start: '2026-02-01',
              end: '2026-02-14',
              label: 'Feb 1–14',
            },
          ],
          rows: [
            {
              client_id: 301,
              client_name: 'Acme Co',
              cells: [
                {
                  period_start: '2026-02-01',
                  period_end: '2026-02-14',
                  checklist_period_id: 102,
                  done_count: 0,
                  total_count: 3,
                  status: 'open',
                },
              ],
            },
          ],
        },
      })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('0/3')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('0/3'))

    await waitFor(() => {
      expect(apiMocks.createPayrollChecklistPeriod).toHaveBeenCalledWith({
        client_id: 301,
        start: '2026-02-01',
        end: '2026-02-14',
      })
      expect(apiMocks.getPayrollChecklistPeriod).toHaveBeenCalledWith(102)
    })
  })

  it('refreshes board when range button clicked', async () => {
    renderPage()

    await waitFor(() => {
      expect(apiMocks.getPayrollChecklistBoard).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Board' }))

    await waitFor(() => {
      expect(apiMocks.getPayrollChecklistBoard).toHaveBeenCalledTimes(2)
    })
  })
})
