import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FadeUp } from '../../components/ui/MotionComponents'

const FORM_PDF_URL = 'http://www.govguamdocs.com/revtax/docs/Form_2848GU.pdf'

export default function Form2848() {
  useEffect(() => {
    document.title = 'Form 2848 (Guam) | Cornerstone Accounting'
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.span
            className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Required Form
          </motion.span>
          <motion.h1
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            Guam <span className="gradient-text">Form 2848</span>
          </motion.h1>
          <motion.p
            className="mt-5 text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            Power of Attorney — required for clients without copies of their prior year tax returns. 
            This form allows our office to request your tax records directly from the Department of Revenue and Taxation (DRT) on your behalf.
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Download Button */}
          <FadeUp>
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-6 md:p-8 mb-12 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Download the Form</h2>
                <p className="text-gray-600">Download Guam Form 2848, fill it out following the instructions below, then bring it to a notary.</p>
              </div>
              <a
                href={FORM_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white px-6 py-3 rounded-xl text-base font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 min-h-[48px] flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Form 2848
              </a>
            </div>
          </FadeUp>

          {/* How to Complete the Form */}
          <FadeUp>
            <div className="mb-14">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-8">How to Complete the Form</h2>
              <div className="space-y-6">

                {/* Section 1 */}
                <div className="bg-secondary rounded-2xl p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl font-bold text-primary/20 leading-none select-none">01</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Section 1 — Taxpayer Information</h3>
                      <p className="text-gray-600 leading-relaxed">
                        Enter your full legal name, current address, and all required personal information.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="bg-secondary rounded-2xl p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl font-bold text-primary/20 leading-none select-none">02</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Section 2 — Representative Information</h3>
                      <p className="text-gray-600 leading-relaxed mb-4">
                        Enter the following exactly as shown:
                      </p>
                      <div className="bg-white rounded-xl p-5 border border-gray-200 text-gray-800 leading-relaxed">
                        <p className="font-semibold">Dafne M. Shimizu</p>
                        <p>130 Aspinall Ave, Suite 202</p>
                        <p>Hag&aring;t&ntilde;a, Guam 96910</p>
                        <p>Phone: 671-727-8242</p>
                      </div>
                      <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p className="text-amber-800 text-sm font-medium">Do not sign this section yet.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="bg-secondary rounded-2xl p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl font-bold text-primary/20 leading-none select-none">03</span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Section 3 — Tax Matters</h3>
                      <div className="space-y-2 text-gray-600">
                        <p><span className="font-semibold text-gray-800">Type of Tax:</span> Income Tax</p>
                        <p><span className="font-semibold text-gray-800">Tax Form Number:</span> 1040</p>
                        <p><span className="font-semibold text-gray-800">Years/Periods:</span> 2022, 2023, 2024</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Next Steps */}
          <FadeUp>
            <div className="mb-14">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-8">Next Steps</h2>
              <div className="space-y-6">

                {/* Step 1 */}
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Print the Completed Form</h3>
                    <p className="text-gray-600 leading-relaxed">
                      The form must be printed before signing.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Notarize the Form</h3>
                    <p className="text-gray-600 leading-relaxed mb-3">
                      You are required to sign the form in the presence of a notary public. 
                      <strong className="text-gray-800"> Do not sign the form in advance.</strong>
                    </p>
                    <div className="bg-secondary rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Notary services are commonly available at:</p>
                      <ul className="space-y-1.5 text-sm text-gray-600">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          Banks or credit unions
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          UPS or FedEx locations
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          Law offices
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          Local notary service providers
                        </li>
                      </ul>
                      <p className="text-sm text-gray-500 mt-3 italic">Please bring a valid photo ID.</p>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Submit the Form to Our Office</h3>
                    <p className="text-gray-600 leading-relaxed">
                      After notarization, return the completed form by dropping it off in person, 
                      or uploading/emailing a clear scanned copy (if permitted).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* What Happens Next */}
          <FadeUp>
            <div className="bg-secondary rounded-2xl p-6 md:p-8 mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">What Happens Next</h2>
              <p className="text-gray-600 leading-relaxed">
                Once we receive your notarized Form 2848, our office will submit it to the Department of 
                Revenue and Taxation (DRT) to obtain your prior year tax records.
              </p>
            </div>
          </FadeUp>

          {/* Important Note */}
          <FadeUp>
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-10">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-900 font-semibold text-sm mb-1">Important Note</p>
                <p className="text-blue-800 text-sm leading-relaxed">
                  The Page 2 — Declaration of Representative section is not required at this time. 
                  This portion will be completed by our office after the form has been notarized and returned.
                </p>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <FadeUp>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-5 tracking-tight">Have Questions?</h2>
            <p className="text-white/85 mb-10 max-w-2xl mx-auto text-lg">
              If you&rsquo;re unsure whether you need to complete this form or need help with the process, don&rsquo;t hesitate to reach out.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={FORM_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-primary px-7 py-3.5 rounded-xl text-base font-medium hover:bg-gray-100 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 min-h-[48px] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Form 2848
              </a>
              <Link
                to="/contact"
                className="bg-transparent text-white border-2 border-white/30 px-7 py-3.5 rounded-xl text-base font-medium hover:bg-white/10 hover:border-white/50 transition-all duration-200 min-h-[48px] flex items-center justify-center"
              >
                Contact Us
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
