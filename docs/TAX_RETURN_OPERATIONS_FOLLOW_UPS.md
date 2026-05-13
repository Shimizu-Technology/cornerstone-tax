# Tax Return Operations Follow-Ups

This PR gives Cornerstone a central tax-return operations tracker: admin-created returns, public-intake-linked returns, client portal visibility, document upload gating, signature status, workflow status, assignment/review, payment tracking, discounts, add-on fee lines, filing status, tax refund or amount owed, and audit history.

The items below are intentionally not blockers for this PR. They are good next-step candidates once the team has tested the current workflow with real Cornerstone tax-return work.

## Recommended Next Iterations

### 1. Printable Receipt or Statement
- Generate a print-friendly receipt or statement from the current fee fields.
- Include base fee, add-on fee lines, discounts, amount paid, balance due, payment notes, and tax refund or amount owed.
- Keep this separate from tax outcome amounts so clients do not confuse Cornerstone's preparation fee with DRT/IRS tax due or refund.

### 2. Formal Tax Return Checklist
- Add a lightweight checklist for common staff controls:
  - Identity verified.
  - Intake documents complete.
  - Missing documents requested.
  - Preparer completed.
  - Reviewer approved.
  - Client reviewed/signature received.
  - Filed/accepted or paper filed.
- Consider due-diligence checklist fields for EITC, CTC/ACTC/ODC, AOTC, and Head of Household when Cornerstone prepares returns where those checks apply.

### 3. Signature Package Tracking
- Keep the current signature status behavior tied to workflow stage.
- Add an optional link from signature completion to the actual uploaded authorization/signature document.
- Track signed by, signed at, and whether the signature was electronic, wet signature, or waived/handled offline.

### 4. Filing Package and Acknowledgment Details
- Extend filing metadata if Cornerstone needs deeper filing operations:
  - Filing method: DRT, IRS, paper, or e-file provider.
  - Submission ID or acknowledgment ID.
  - Accepted/rejected timestamp.
  - Rejection reason and staff resolution notes.
- The current DRT/IRS confirmation fields are enough for the first version.

### 5. Business Return Readiness
- Keep the current return type/form fields flexible until Cornerstone confirms its service menu.
- Later, consider business-specific readiness fields:
  - Entity type and return family, such as Schedule C, 1065, 1120S, 1120, or nonprofit return.
  - Bookkeeping ready/not ready.
  - W-2/1099/K-1 documents received.
  - Gross receipts, payroll, and owner distribution notes if Cornerstone needs them operationally.

### 6. Document Retention and Security
- Define how long uploaded taxpayer documents should be retained.
- Add staff-only retention/deletion workflows if required.
- Continue avoiding sensitive taxpayer data in plain-text operational notes where possible.
- Review access/audit policies before expanding document export or bulk download features.

## Why These Are Deferred

The current PR focuses on the core operational gap: knowing what returns exist, who is working them, where they are in the process, what the payment/filing/signature/document state is, and what happened over time.

The follow-ups above are useful, but adding all of them now would make the first release harder to test and harder for staff to adopt. The fee-line, tax-outcome, document, signature, and audit foundations added in this PR are flexible enough to support those next steps without another major model rewrite.

