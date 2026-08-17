import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReportExportActions from './ReportExportActions'

describe('ReportExportActions', () => {
  it('makes PDF the primary export for the all-employee report', () => {
    const onExport = vi.fn()

    render(
      <ReportExportActions employeeSelected={false} hasResults loading={false} exporting={null} onExport={onExport} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /download pdf report/i }))

    expect(onExport).toHaveBeenCalledWith('pdf')
    expect(screen.getByText('Recommended')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /detailed csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /payroll csv/i })).toBeInTheDocument()
  })

  it('labels the primary PDF as a timesheet when one employee is selected', () => {
    const onExport = vi.fn()

    render(
      <ReportExportActions employeeSelected hasResults loading={false} exporting={null} onExport={onExport} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /download timesheet pdf/i }))

    expect(onExport).toHaveBeenCalledWith('pdf')
    expect(screen.getByText(/share-ready employee timesheet/i)).toBeInTheDocument()
  })

  it('disables all exports when the report has no results', () => {
    render(
      <ReportExportActions employeeSelected={false} hasResults={false} loading={false} exporting={null} onExport={vi.fn()} />,
    )

    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
  })
})
