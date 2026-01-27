# Brand Update Plan - Cornerstone Accounting

**Created:** January 24, 2026  
**Source:** Social media brand materials in `updated-logo-and-values/` folder  
**Status:** In Progress

---

## Overview

Update the website to align with Cornerstone's updated branding, messaging, and business information as published on their social media.

---

## Brand Color Analysis

From the images, the brand uses:
- **Background**: Light cream/beige with pink tint (`#F5F3EF` or similar)
- **Primary Text**: Dark charcoal/black (`#2D2A26` or `#1A1A1A`)
- **Accent/Tagline**: Rose gold/copper (`#C9A88A` or `#D4C4B0`)
- **Decorative elements**: Black lines for borders

**Current website colors** (from `index.css`):
- Primary: `#8B7355` (warm brown) - close to brand
- Secondary: `#F5F0E8` (cream) - very close, maybe slightly less pink
- Accent: `#E8B4B8` (light pink)

**Recommendation**: Colors are close enough. Minor adjustment to secondary background color optional.

---

## Tasks

### Phase 1: Logo Update

- [x] **1.1 Update Logo File** ✅ COMPLETED
  - Cropped logo from Image 1 (`Beige and Brown Simple...Post - 1.PNG`)
  - Saved as `frontend/public/logo.png` (1080x650, PNG format)
  - Old logo backed up as `frontend/public/logo-old.jpeg`
  - Updated all references in:
    - `Header.tsx` - simplified styling for new wider format
    - `Footer.tsx` - updated with white background container
    - `AdminLayout.tsx` - both mobile and desktop sidebar
    - `IntakeForm.tsx` - simplified styling
  - Verified working on: Home, About, Contact, Services, Intake pages

- [ ] **1.2 Update Color Variables (Optional)**
  - File: `frontend/src/index.css`
  - Consider adjusting secondary to `#F5F3EF` for slightly pinker cream
  - Low priority - current colors work well

---

### Phase 2: About Page Updates

File: `frontend/src/pages/public/About.tsx`

- [ ] **2.1 Update Core Values - Change "Competence" to "Education"**
  
  **Current (line 21-23):**
  ```tsx
  {
    name: 'Competence',
    description: 'Decades of experience and continuous learning ensure expert guidance you can trust.',
  },
  ```
  
  **New:**
  ```tsx
  {
    name: 'Education',
    description: 'We empower our clients with knowledge, helping them understand their finances and make informed decisions.',
  },
  ```

- [ ] **2.2 Update Hero Description**
  
  **Current (line 34-36):**
  > Cornerstone Accounting and Business Management is a firm based in Guam with the mission of helping individuals, entrepreneurs, and businesses with their tax and accounting needs.
  
  **New (from brand):**
  > Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.

- [ ] **2.3 Update "What We Do" Section**
  
  **Current (lines 47-56):**
  > At Cornerstone we take pride in providing reliable accounting, income tax preparation and assistance, and payroll processing services designed to meet our clients where they are—whether they are starting a business, growing operations, or navigating complex financial and tax matters.
  >
  > Our services include accounting and bookkeeping, income tax preparation, payroll processing, financial statement preparation, QuickBooks and accounting training, and other consulting services.
  >
  > Based in Hagatna, Guam, we serve individuals and businesses throughout the island with personalized, professional service.
  
  **New (from brand):**
  > We provide income tax preparation, accounting, consulting, and payroll services, with a focus on clarity, accuracy, and dependable guidance. Our goal is to support confident decision-making and long-term financial success.
  >
  > We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
  >
  > At Cornerstone, we believe accounting is more than numbers—it's about people, goals, and informed decisions.

- [ ] **2.4 Update Owner Bio (Dafne Shimizu)**
  
  **Current (lines 66-75):**
  > Dafne Shimizu is a US licensed CPA born on Guam and raised in the village of Merizo. A proud Triton, she earned her bachelor's degree in Accounting and her master's degree in Public Administration from the University of Guam.
  >
  > With over three decades of accounting experience, as well as managerial and executive experience, Dafne brings a wealth of knowledge to every client relationship.
  >
  > Her parents, Felix and Dot Mansapit, taught her the values of hard work and the importance of education—values she carries into her practice every day. Above all, Dafne cares for her clients.
  
  **New (from brand - exact wording):**
  > Dafne Shimizu is a U.S.-licensed CPA born and raised on Guam. A proud Triton, she earned her bachelor's degree in Accounting and her master's degree in Public Administration.
  >
  > With over 30 years of accounting experience, including managerial and executive leadership, Dafne brings thoughtful, dependable guidance to every client relationship.
  >
  > Raised in the village of Merizo, her values were shaped by her parents, Felix and Dot Mansapit, who instilled the importance of hard work, education, and integrity.
  >
  > At the core of her work is a simple belief: accounting should support people, not overwhelm them.
  
  **Key changes:**
  - "US licensed" → "U.S.-licensed"
  - "born on Guam and raised in the village of Merizo" → "born and raised on Guam" (Merizo mentioned later)
  - Remove "from the University of Guam" (just says "proud Triton")
  - "three decades" → "30 years"
  - "managerial and executive experience" → "managerial and executive leadership"
  - Add closing belief statement

- [ ] **2.5 Update Mission Statement**
  
  **Current (lines 94-96):**
  > Our mission is to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients' lives.
  
  **New (from brand):**
  > We are a family operated business with a mission to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients' lives.

- [ ] **2.6 Add Brand Tagline**
  
  Add somewhere prominent:
  > Based in Guam. Built on integrity, accuracy, and trust.

- [ ] **2.7 Update Values Closing Text**
  
  **Current (lines 119-120):**
  > These principles guide everything we do and define who we are as a firm.
  
  **New (from brand):**
  > These values shape how we work and how we serve our community.

---

### Phase 3: Home Page Updates

File: `frontend/src/pages/public/Home.tsx`

- [ ] **3.1 Update Values Array - Change "Competence" to "Education"**
  
  **Current (line 47):**
  ```tsx
  { name: 'Competence', description: 'Decades of expertise you can trust' },
  ```
  
  **New:**
  ```tsx
  { name: 'Education', description: 'Empowering you with financial knowledge' },
  ```

- [ ] **3.2 Review Hero Tagline**
  
  **Current (lines 61-63):**
  > We believe accounting is more than numbers—it's about people, goals, and informed decision-making. Let us help you build a strong financial foundation.
  
  **Brand says:**
  > At Cornerstone, we believe accounting is more than numbers—it's about people, goals, and informed decisions.
  
  **Status:** ✅ Already very close - minor wording difference ("decision-making" vs "decisions")

- [ ] **3.3 Update "Why Choose Cornerstone" Section**
  
  **Current (lines 127-132):**
  > We believe accounting should empower, not overwhelm. Our approach is hands-on, collaborative, and tailored to each client's unique needs.
  >
  > We translate financial data into clear insights so you can stay compliant, improve cash flow, and plan strategically for the future.
  
  **New (from brand - exact):**
  > We believe accounting should empower, not overwhelm.
  >
  > Our approach is hands-on, collaborative, and tailored to each client's unique needs. We translate financial data into clear, practical insights so our clients can stay compliant, improve cash flow, and plan strategically with confidence.
  
  **Key changes:**
  - "clear insights" → "clear, practical insights"
  - "you can" → "our clients can"
  - "for the future" → "with confidence"

- [ ] **3.4 Consider Adding Taglines**
  
  Potential additions:
  - "Reliable support. Clear insights. Thoughtful guidance."
  - "Your numbers, explained clearly, every step of the way."
  - "Based in Guam. Built on integrity, accuracy, and trust."

---

### Phase 4: Contact Page Updates

File: `frontend/src/pages/public/Contact.tsx`

- [ ] **4.1 Update Business Hours**
  
  **Current (lines 266-269):**
  > Monday - Friday: 9:00 AM - 5:00 PM
  > (Extended hours during tax season)
  
  **New (from brand - exact):**
  ```
  Monday - Friday: 8:00 AM - 5:00 PM
  Saturday: 9:00 AM - 1:00 PM
  Sunday: Closed
  ```

- [ ] **4.2 Add Hours Disclaimers**
  
  Add after hours:
  > Holiday hours may vary. Please contact us to confirm availability.
  
  And/or:
  > Our hours may vary to better serve our clients. For questions or to schedule an appointment, please reach out by phone or WhatsApp.

- [ ] **4.3 Update Phone Number Display**
  
  **Current (lines 233-236):**
  ```tsx
  <a href="tel:+16714828671" className="hover:text-primary">(671) 482-8671</a><br />
  <a href="tel:+16718288591" className="hover:text-primary">(671) 828-8591</a>
  ```
  
  **New (with labels from brand):**
  ```tsx
  Office: <a href="tel:+16718288591">(671) 828-8591</a><br />
  Cell: <a href="tel:+16714828671">(671) 482-8671</a>
  ```
  
  **Note:** Brand shows Office first, then Cell

- [ ] **4.4 Add WhatsApp Mention**
  
  Add to contact section or hours section:
  > For questions or to schedule an appointment, please reach out by phone or WhatsApp.

---

### Phase 5: Services Page Updates

File: `frontend/src/pages/public/Services.tsx`

- [ ] **5.1 Review Service List Against Brand**
  
  **Brand services (Image 3):**
  - Accounting & bookkeeping ✅
  - Tax preparation ✅
  - Payroll & compliance support ✅
  - Financial statement preparation ✅
  - Consulting ✅
  - QuickBooks & basic accounting training / support ✅
  
  **Current website has 6 services:** Tax Prep, Accounting, Payroll, Financial Statements, Business Advisory, QuickBooks
  
  **Status:** ✅ Services align well

- [ ] **5.2 Update Hero Description**
  
  **Current (lines 110-111):**
  > From tax preparation to business advisory, we provide comprehensive services designed to meet you where you are—whether you're starting a business, growing operations, or navigating complex financial matters.
  
  **New (from brand):**
  > We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.

- [ ] **5.3 Consider Adding Tagline**
  
  Add:
  > Reliable support. Clear insights. Thoughtful guidance.

---

### Phase 6: Footer Updates

File: `frontend/src/components/layouts/Footer.tsx`

- [ ] **6.1 Review Company Description**
  
  **Current (line 19-21):**
  > Full-service accounting and advisory firm dedicated to helping individuals and businesses build strong financial foundations.
  
  **Brand says:**
  > Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
  
  **Status:** ✅ Close enough - current is fine

- [ ] **6.2 Ensure Phone Number Consistency**
  
  Currently shows `(671) 482-8671` - this is the Cell number
  Consider showing both with labels or just Office number

---

### Phase 7: Testing & Verification

- [ ] **7.1 Visual Review - All Pages Desktop**
  - Home, About, Services, Contact
  - Verify all content matches brand materials

- [ ] **7.2 Visual Review - All Pages Mobile**
  - Test at 375px width
  - Ensure responsive design works

- [ ] **7.3 Cross-Reference Consistency Check**
  - Values consistent: Home ↔ About
  - Hours consistent: Contact ↔ Footer (if shown)
  - Phone numbers consistent everywhere
  - Mission/taglines consistent

- [ ] **7.4 Proofread All Changes**
  - Check for typos
  - Ensure punctuation is correct

---

## Exact Content from Brand Images (Verified)

### Image 1 - Logo
- "CORNERSTONE" in bold serif with thin rectangular border
- "ACCOUNTING & BUSINESS MANAGEMENT" in rose gold below with decorative dashes

### Image 2 - About (with logo)
> Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
>
> We provide income tax preparation, accounting, consulting, and payroll services, with a focus on clarity, accuracy, and dependable guidance. Our goal is to support confident decision-making and long-term financial success.
>
> At Cornerstone, we believe accounting is more than number, it's about people, goals, and informed decisions.
>
> Based in Guam.
> Built on integrity, accuracy, and trust.
>
> HTTPS://CORNERSTONE-ACCOUNTING.TAX

### Image 3 - What We Do
> We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
>
> Our services include:
> • Accounting & bookkeeping
> • Tax preparation
> • Payroll & compliance support
> • Financial statement preparation
> • Consulting
> • QuickBooks & basic accounting training / support
>
> Reliable support. Clear insights. Thoughtful guidance.

### Image 4 - How We Support Our Clients
> We believe accounting should empower, not overwhelm.
>
> Our approach is hands-on, collaborative, and tailored to each client's unique needs. We translate financial data into clear, practical insights so our clients can stay compliant, improve cash flow, and plan strategically with confidence.
>
> Your numbers, explained clearly, every step of the way.

### Image 5 - Our Mission & Values
> We are a family operated business with a mission to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients lives.
>
> We are guided by:
> • Integrity
> • Accuracy
> • Client partnership
> • Responsiveness
> • Education
>
> These values shape how we work and how we serve our community.

### Image 6 - Opening Hours
> **OPENING HOURS**
> MONDAY      8AM - 5PM
> TUESDAY     8AM - 5PM
> WEDNESDAY   8AM - 5PM
> THURSDAY    8AM - 5PM
> FRIDAY      8AM - 5PM
> SATURDAY    9AM - 1PM
> SUNDAY      CLOSED
>
> Holiday hours may vary. Please contact us to confirm availability.
> Office (671)828-8591  Cell (671) 482-8671
>
> Our hours may vary to better serve our clients. For questions or to schedule an appointment, please reach out to our team by phone or WhatsApp.

### Image 7 - Meet the Owner
> **Dafne Shimizu, CPA**
> Founder & Owner
>
> Dafne Shimizu is a U.S.-licensed CPA born and raised on Guam. A proud Triton, she earned her bachelor's degree in Accounting and her master's degree in Public Administration.
>
> With over 30 years of accounting experience, including managerial and executive leadership, Dafne brings thoughtful, dependable guidance to every client relationship.
>
> Raised in the village of Merizo, her values were shaped by her parents, Felix and Dot Mansapit, who instilled the importance of hard work, education, and integrity.
>
> At the core of her work is a simple belief: accounting should support people, not overwhelm them.

---

## Notes & Decisions Needed

### Logo
- **Need actual logo file** - Current images are Instagram posts, not standalone logos
- Options:
  1. Ask client for PNG/SVG with transparent background (recommended)
  2. Crop from Image 1 or Image 6 (lower quality)

### Minor Typos in Brand Materials
- Image 2: "more than number" (should be "numbers") - we'll use "numbers"
- Image 5: "clients lives" (should be "clients' lives") - we'll add apostrophe

### Phone Number Order
- Brand shows: Office (671)828-8591 first, Cell (671) 482-8671 second
- Current website shows them in different order in different places
- We'll standardize to: Office first, Cell second

---

## Completion Checklist

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Logo & Colors | ✅ Complete |
| 2 | About Page Content | ✅ Complete |
| 3 | Home Page Content | ✅ Complete |
| 4 | Contact Page Content | ✅ Complete |
| 5 | Services Page Content | ✅ Complete |
| 6 | Footer Updates | ✅ Complete |
| 7 | Testing & Verification | ✅ Complete |

---

*Last Updated: January 24, 2026*
