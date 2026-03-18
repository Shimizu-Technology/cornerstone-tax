import { forwardRef } from 'react'
import { formatDate } from '../../lib/dateUtils'
import { getFilingStatusLabel } from '../../lib/constants'

interface Dependent {
  id: number
  name: string
  date_of_birth: string
  relationship: string
  months_lived_with_client: number
  is_student: boolean
  is_disabled: boolean
}

interface IncomeSource {
  id: number
  source_type: string
  payer_name: string
}

interface TaxReturn {
  id: number
  tax_year: number
  status: string
  income_sources: IncomeSource[]
}

interface ClientData {
  full_name: string
  first_name: string
  last_name: string
  date_of_birth: string
  email: string
  phone: string
  mailing_address: string
  filing_status: string
  is_new_client: boolean
  has_prior_year_return: boolean
  changes_from_prior_year: string
  spouse_name: string
  spouse_dob: string
  denied_eic_actc: boolean
  denied_eic_actc_year: number | null
  has_crypto_transactions: boolean
  wants_direct_deposit: boolean
  client_type: 'individual' | 'business'
  business_name: string | null
  dependents: Dependent[]
  tax_returns: TaxReturn[]
  created_at: string
}

interface Props {
  client: ClientData
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099_misc': '1099-MISC',
  '1099_int': '1099-INT',
  '1099_div': '1099-DIV',
  '1099_nec': '1099-NEC',
  '1099_r': '1099-R',
  '1099_ssa': 'SSA-1099',
}

function formatSourceType(type: string): string {
  return SOURCE_TYPE_LABELS[type] || type.replace(/_/g, '-').toUpperCase()
}

const PrintableIntakeForm = forwardRef<HTMLDivElement, Props>(({ client }, ref) => {
  const latestReturn = client.tax_returns[0]
  const incomeSources = latestReturn?.income_sources || []

  const w2Sources = incomeSources.filter(s => s.source_type === 'w2')
  const otherSources = incomeSources.filter(s => s.source_type !== 'w2')

  return (
    <div ref={ref} className="print-intake-form">
      {/* Header */}
      <div className="print-header">
        <h1>Client Intake Form</h1>
        <p className="print-subtitle">Cornerstone Accounting & Business Services</p>
        <p className="print-date">
          Tax Year: {latestReturn?.tax_year || new Date().getFullYear()}
          {' · '}
          Submitted: {formatDate(client.created_at)}
        </p>
      </div>

      {/* Section 1: Client Information */}
      <div className="print-section">
        <h2>Client Information</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">Name</td>
              <td>{client.full_name}</td>
              <td className="print-label">Date of Birth</td>
              <td>{client.date_of_birth ? formatDate(client.date_of_birth) : '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Email</td>
              <td>{client.email}</td>
              <td className="print-label">Phone</td>
              <td>{client.phone}</td>
            </tr>
            <tr>
              <td className="print-label">Mailing Address</td>
              <td colSpan={3}>{client.mailing_address || '—'}</td>
            </tr>
            {client.client_type === 'business' && client.business_name && (
              <tr>
                <td className="print-label">Business Name</td>
                <td colSpan={3}>{client.business_name}</td>
              </tr>
            )}
            <tr>
              <td className="print-label">New Client</td>
              <td>{client.is_new_client ? 'Yes' : 'No'}</td>
              <td className="print-label">Client Type</td>
              <td>{client.client_type === 'business' ? 'Business' : 'Individual'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Tax Filing Info */}
      <div className="print-section">
        <h2>Tax Filing Information</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">Filing Status</td>
              <td>{getFilingStatusLabel(client.filing_status)}</td>
              <td className="print-label">Return Status</td>
              <td>{latestReturn?.status || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Prior Year Return</td>
              <td>{client.has_prior_year_return ? 'Yes' : 'No'}</td>
              <td className="print-label">Direct Deposit</td>
              <td>{client.wants_direct_deposit ? 'Yes' : 'No'}</td>
            </tr>
            {client.changes_from_prior_year && (
              <tr>
                <td className="print-label">Changes from Prior Year</td>
                <td colSpan={3}>{client.changes_from_prior_year}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 3: Income Sources */}
      {incomeSources.length > 0 && (
        <div className="print-section">
          <h2>Income Sources</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Payer / Employer Name</th>
              </tr>
            </thead>
            <tbody>
              {w2Sources.map((src) => (
                <tr key={src.id}>
                  <td>{formatSourceType(src.source_type)}</td>
                  <td>{src.payer_name}</td>
                </tr>
              ))}
              {otherSources.map((src) => (
                <tr key={src.id}>
                  <td>{formatSourceType(src.source_type)}</td>
                  <td>{src.payer_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 4: Special Questions */}
      <div className="print-section">
        <h2>Special Questions</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">Denied EIC/ACTC/HOH</td>
              <td>
                {client.denied_eic_actc
                  ? `Yes — ${client.denied_eic_actc_year || 'year not specified'}`
                  : 'No'}
              </td>
            </tr>
            <tr>
              <td className="print-label">Cryptocurrency Transactions</td>
              <td>{client.has_crypto_transactions ? 'Yes' : 'No'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 5: Spouse Information */}
      {client.spouse_name && (
        <div className="print-section">
          <h2>Spouse Information</h2>
          <table className="print-table">
            <tbody>
              <tr>
                <td className="print-label">Name</td>
                <td>{client.spouse_name}</td>
                <td className="print-label">Date of Birth</td>
                <td>{client.spouse_dob ? formatDate(client.spouse_dob) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Section 6: Dependents */}
      {client.dependents.length > 0 && (
        <div className="print-section">
          <h2>Dependents ({client.dependents.length})</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date of Birth</th>
                <th>Relationship</th>
                <th>Months</th>
                <th>Student</th>
                <th>Disabled</th>
              </tr>
            </thead>
            <tbody>
              {client.dependents.map((dep) => (
                <tr key={dep.id}>
                  <td>{dep.name}</td>
                  <td>{dep.date_of_birth ? formatDate(dep.date_of_birth) : '—'}</td>
                  <td>{dep.relationship}</td>
                  <td>{dep.months_lived_with_client}</td>
                  <td>{dep.is_student ? 'Yes' : 'No'}</td>
                  <td>{dep.is_disabled ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="print-footer">
        <p>Printed from Cornerstone Accounting Platform · {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  )
})

PrintableIntakeForm.displayName = 'PrintableIntakeForm'

export default PrintableIntakeForm
