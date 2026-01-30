// Types for client intake form
// Force rebuild

export interface Dependent {
  name: string;
  date_of_birth: string;
  relationship: string;
  months_lived_with_client: number | '';
  is_student: boolean;
  is_disabled: boolean;
  can_be_claimed_by_other: boolean;
}

export interface IncomeSource {
  source_type: string;
  payer_name: string;
  notes: string;
}

export interface IntakeFormData {
  // Section 1: Client Information
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  mailing_address: string;

  // Section 2: Tax Filing Information
  tax_year: number;
  filing_status: 'single' | 'married' | 'hoh' | 'other' | '';
  is_new_client: boolean;
  has_prior_year_return: boolean;
  changes_from_prior_year: string;

  // Section 3: Income Sources
  income_sources: IncomeSource[];
  w2_employers: string[];
  form_1099_types: string[];
  form_1099_payer_names: Record<string, string>;

  // Section 4: Special Questions
  denied_eic_actc: boolean;
  denied_eic_actc_year: number | '';
  has_crypto_transactions: boolean;

  // Section 5: Spouse Information
  spouse_name: string;
  spouse_dob: string;

  // Section 6: Dependents
  dependents: Dependent[];

  // Section 7: Direct Deposit
  wants_direct_deposit: boolean;
  bank_routing_number: string;
  bank_account_number: string;
  bank_account_type: 'checking' | 'savings' | '';

  // Section 8: Authorization
  authorization_confirmed: boolean;
  signature: string;
  signature_date: string;
}

export const defaultIntakeFormData: IntakeFormData = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  mailing_address: '',
  tax_year: new Date().getFullYear(),
  filing_status: '',
  is_new_client: true,
  has_prior_year_return: false,
  changes_from_prior_year: '',
  income_sources: [],
  w2_employers: [''],
  form_1099_types: [],
  form_1099_payer_names: {},
  denied_eic_actc: false,
  denied_eic_actc_year: '',
  has_crypto_transactions: false,
  spouse_name: '',
  spouse_dob: '',
  dependents: [],
  wants_direct_deposit: false,
  bank_routing_number: '',
  bank_account_number: '',
  bank_account_type: '',
  authorization_confirmed: false,
  signature: '',
  signature_date: new Date().toISOString().split('T')[0],
};

export const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married Filing Jointly' },
  { value: 'hoh', label: 'Head of Household' },
  { value: 'other', label: 'Other' },
];

export const FORM_1099_TYPES = [
  { value: '1099_misc', label: '1099-MISC' },
  { value: '1099_int', label: '1099-INT (Interest)' },
  { value: '1099_div', label: '1099-DIV (Dividends)' },
  { value: '1099_nec', label: '1099-NEC (Nonemployee Compensation)' },
  { value: '1099_r', label: '1099-R (Retirement)' },
  { value: '1099_ssa', label: 'SSA-1099 (Social Security)' },
];

export const emptyDependent: Dependent = {
  name: '',
  date_of_birth: '',
  relationship: '',
  months_lived_with_client: '',
  is_student: false,
  is_disabled: false,
  can_be_claimed_by_other: false,
};
