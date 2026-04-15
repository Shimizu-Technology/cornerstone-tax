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
  other_income: string | null
  comments: string | null
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

const FILING_STATUSES = [
  { value: 'married', label: 'Married Filing Joint' },
  { value: 'single', label: 'Single' },
  { value: 'married_separate', label: 'Married Filing Separate' },
  { value: 'hoh', label: 'Head of Household' },
  { value: 'other', label: 'Other' },
]

export default function PrintableIntakeForm({ client }: Props) {
  const latestReturn = client.tax_returns[0]
  const incomeSources = latestReturn?.income_sources || []
  const taxYear = latestReturn?.tax_year || new Date().getFullYear()

  const w2Sources = incomeSources.filter(s => s.source_type === 'w2')
  const form1099Sources = incomeSources.filter(s => s.source_type !== 'w2')

  return (
    <div className="print-intake-form" id="print-intake-form">
      {/* ===== TWO-COLUMN LAYOUT matching their physical form ===== */}
      <div className="print-columns">

        {/* ===== LEFT COLUMN ===== */}
        <div className="print-col-left">

          {/* Header */}
          <h1 className="print-title">Cornerstone — Client Intake Form</h1>

          {/* Client info fields */}
          <div className="print-field">
            <span className="print-field-label">Date/Time:</span>
            <span className="print-field-value">{formatDate(client.created_at)}</span>
          </div>
          <div className="print-field">
            <span className="print-field-label">Client Name:</span>
            <span className="print-field-value">{client.full_name}</span>
          </div>
          <div className="print-field">
            <span className="print-field-label">DOB:</span>
            <span className="print-field-value">{client.date_of_birth ? formatDate(client.date_of_birth) : '—'}</span>
          </div>
          <div className="print-field">
            <span className="print-field-label">Contact No.:</span>
            <span className="print-field-value">{client.phone}</span>
          </div>
          <div className="print-field">
            <span className="print-field-label">Email:</span>
            <span className="print-field-value">{client.email}</span>
          </div>
          <div className="print-field">
            <span className="print-field-label">Mailing Address:</span>
            <span className="print-field-value">{client.mailing_address || '—'}</span>
          </div>
          {client.client_type === 'business' && client.business_name && (
            <div className="print-field">
              <span className="print-field-label">Business Name:</span>
              <span className="print-field-value">{client.business_name}</span>
            </div>
          )}

          <div className="print-divider" />

          {/* Filing Status */}
          <p className="print-field-label" style={{ marginBottom: '4pt' }}>Filing Status:</p>
          <div className="print-filing-status">
            {FILING_STATUSES.map(fs => (
              <span key={fs.value} className={`print-status-option ${
                client.filing_status === fs.value || 
                (fs.value === 'hoh' && client.filing_status === 'head_of_household')
                  ? 'print-status-selected' : ''
              }`}>
                {fs.label}
              </span>
            ))}
          </div>

          <div className="print-divider" />

          {/* Returning/New Client Questions */}
          <div className="print-qa">
            <p className="print-q">
              *{client.is_new_client ? 'New' : 'Returning'} Client — {client.is_new_client
                ? `Has prior year return: ${client.has_prior_year_return ? 'Yes' : 'No'}`
                : `Changes from prior year: ${client.changes_from_prior_year || 'None noted'}`
              }
            </p>
          </div>

          <div className="print-qa">
            <p className="print-q">
              *Denied tax credit (EIC, ACTC) by IRS?{' '}
              <strong>{client.denied_eic_actc
                ? `Yes — ${client.denied_eic_actc_year || 'year not specified'}`
                : 'No'}</strong>
            </p>
          </div>

          <div className="print-qa">
            <p className="print-q">
              *During {taxYear}, did you receive, sell, exchange, or dispose of a digital asset?{' '}
              <strong>{client.has_crypto_transactions ? 'Yes' : 'No'}</strong>
            </p>
          </div>

          <div className="print-divider" />

          {/* Section 1: Spouse and Dependent Info */}
          <h2 className="print-section-title">Section 1: Spouse and Dependent Information</h2>
          <div className="print-field">
            <span className="print-field-label">Spouse's Name:</span>
            <span className="print-field-value">{client.spouse_name || 'N/A'}</span>
          </div>
          {client.spouse_name && (
            <div className="print-field">
              <span className="print-field-label">Spouse DOB:</span>
              <span className="print-field-value">{client.spouse_dob ? formatDate(client.spouse_dob) : '—'}</span>
            </div>
          )}

          <p className="print-small-note" style={{ marginTop: '6pt' }}>
            For Dependents: If None, indicate "N/A"
          </p>

          {client.dependents.length === 0 ? (
            <p className="print-field-value" style={{ marginTop: '2pt' }}>N/A</p>
          ) : (
            <table className="print-dep-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>DOB</th>
                  <th>Relationship</th>
                  <th>Months</th>
                  <th>Student</th>
                  <th>Disabled</th>
                </tr>
              </thead>
              <tbody>
                {client.dependents.map(dep => (
                  <tr key={dep.id}>
                    <td>{dep.name}</td>
                    <td>{dep.date_of_birth ? formatDate(dep.date_of_birth) : '—'}</td>
                    <td>{dep.relationship}</td>
                    <td>{dep.months_lived_with_client}</td>
                    <td>{dep.is_student ? 'Yes' : '—'}</td>
                    <td>{dep.is_disabled ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="print-col-right">

          {/* Section 3: Income Information */}
          <h2 className="print-section-title">Section 2: Income Information</h2>

          {incomeSources.length === 0 ? (
            <p className="print-field-value">N/A</p>
          ) : (
            <>
              {w2Sources.length > 0 && (
                <div className="print-income-group">
                  <p className="print-field-label">W-2(s) from:</p>
                  {w2Sources.map(src => (
                    <p key={src.id} className="print-income-item">• {src.payer_name}</p>
                  ))}
                </div>
              )}
              {form1099Sources.length > 0 && (
                <div className="print-income-group">
                  <p className="print-field-label">1099 / Other Forms:</p>
                  {form1099Sources.map(src => (
                    <p key={src.id} className="print-income-item">• {formatSourceType(src.source_type)}: {src.payer_name}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {client.other_income && (
            <div className="print-income-group" style={{ marginTop: '6pt' }}>
              <p className="print-field-label">Other Income:</p>
              <p className="print-field-value">{client.other_income}</p>
            </div>
          )}

          <div className="print-divider" />

          {/* Section 4: Refund Preference */}
          <h2 className="print-section-title">Section 3: Refund Preference</h2>
          <div className="print-field">
            <span className="print-field-label">Method:</span>
            <span className="print-field-value">
              {client.wants_direct_deposit ? 'Direct Deposit' : 'Check'}
            </span>
          </div>
          {client.wants_direct_deposit && (
            <p className="print-small-note">
              (Bank details on file — not printed for security)
            </p>
          )}

          <div className="print-divider" />

          {/* Comments */}
          {client.comments && (
            <>
              <h2 className="print-section-title">Client Comments</h2>
              <p className="print-field-value">{client.comments}</p>
              <div className="print-divider" />
            </>
          )}

          {/* Section 5: Authorization */}
          <h2 className="print-section-title">Section 4: Taxpayer Authorization</h2>
          <p className="print-auth-text">
            I confirm that the information provided is accurate to the best of my knowledge. 
            I authorize my tax preparer to use this information to prepare my {taxYear} tax return.
          </p>

          <div className="print-sig-line">
            <span className="print-field-label">Signature/Date:</span>
            <span className="print-sig-blank" />
          </div>

          {client.spouse_name && (
            <div className="print-sig-line">
              <span className="print-field-label">Spouse's Signature/Date:</span>
              <span className="print-sig-blank" />
            </div>
          )}

          <div className="print-divider" />

          {/* For Office Use Only */}
          <div className="print-office-box">
            <h3 className="print-office-title">For Office Use Only</h3>
            <div className="print-field">
              <span className="print-field-label">Return Status:</span>
              <span className="print-field-value">{latestReturn?.status || '—'}</span>
            </div>
            <div className="print-field">
              <span className="print-field-label">Filing Status:</span>
              <span className="print-field-value">{getFilingStatusLabel(client.filing_status)}</span>
            </div>
            <div className="print-checkbox-row">
              <span>☐ Documents Complete</span>
              <span>☐ Documents Pending</span>
            </div>
            <div className="print-field">
              <span className="print-field-label">Notes:</span>
              <span className="print-sig-blank" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="print-footer">
        <p>Printed from Cornerstone Accounting Platform · {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  )
}
