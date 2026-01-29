import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'

/* ── Reusable scroll-reveal ── */
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

const services = [
  {
    title: 'Tax Preparation & Planning',
    description: 'Expert tax preparation for individuals and businesses, combined with proactive planning strategies to minimize your tax burden and maximize your returns.',
    features: [
      'Individual tax returns (Form 1040)',
      'Business tax returns (1120, 1120S, 1065)',
      'Guam and federal tax filing',
      'Tax planning and strategy',
      'Prior year returns and amendments',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    accent: 'from-primary/10 to-accent/10',
  },
  {
    title: 'Accounting & Bookkeeping',
    description: 'Comprehensive accounting services to keep your financial records accurate, organized, and ready for informed decision-making.',
    features: [
      'Monthly bookkeeping',
      'Account reconciliation',
      'General ledger maintenance',
      'Chart of accounts setup',
      'Clean-up and catch-up services',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    accent: 'from-accent/10 to-primary/5',
  },
  {
    title: 'Payroll & Compliance',
    description: 'Reliable payroll processing and compliance support to ensure your employees are paid accurately and on time, every time.',
    features: [
      'Payroll processing',
      'Payroll tax filings',
      'W-2 and 1099 preparation',
      'New hire reporting',
      'Compliance monitoring',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    accent: 'from-primary/5 to-accent/10',
  },
  {
    title: 'Financial Statement Preparation',
    description: 'Clear, accurate financial statements that give you visibility into your business performance and help you make informed decisions.',
    features: [
      'Balance sheets',
      'Income statements',
      'Cash flow statements',
      'Custom financial reports',
      'Trend analysis',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: 'from-accent/10 to-primary/10',
  },
  {
    title: 'Business Advisory & Consulting',
    description: 'Strategic guidance to help you start, grow, or navigate complex situations. We partner with you to achieve your business goals.',
    features: [
      'Business entity selection',
      'Financial planning',
      'Cash flow management',
      'Growth strategy',
      'Exit planning',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    accent: 'from-primary/10 to-accent/5',
  },
  {
    title: 'QuickBooks & Cloud Accounting',
    description: 'Expert setup and support for QuickBooks and other cloud-based accounting solutions to streamline your financial management.',
    features: [
      'QuickBooks setup and training',
      'Data migration',
      'Cloud accounting solutions',
      'Software integration',
      'Ongoing support',
    ],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    accent: 'from-accent/5 to-primary/10',
  },
]

export default function Services() {
  useEffect(() => { document.title = 'Services | Cornerstone Accounting' }, [])

  return (
    <div className="overflow-hidden">
      {/* ═══════ Hero ═══════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-white to-secondary-dark" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#B9A39912_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Our Expertise</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6 font-[family-name:var(--font-display)]">
              Our Services
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
              We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
            </p>
            <p className="mt-4 text-base text-primary font-medium italic">
              Reliable support. Clear insights. Thoughtful guidance.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ Services — Alternating cards with asymmetric layout ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="space-y-16 lg:space-y-24">
            {services.map((service, index) => (
              <FadeUp key={service.title}>
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start ${
                  index % 2 === 1 ? '' : ''
                }`}>
                  {/* Service card */}
                  <div className={`lg:col-span-6 ${index % 2 === 1 ? 'lg:col-start-7 lg:order-2' : ''}`}>
                    <div className={`group relative bg-gradient-to-br ${service.accent} rounded-3xl p-8 lg:p-10 border border-neutral-warm/30 h-full
                      hover:shadow-lg hover:shadow-primary/5 transition-all duration-300`}>
                      {/* Service number */}
                      <div className="absolute top-6 right-6 text-6xl font-bold text-primary/5 font-[family-name:var(--font-display)] select-none">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="relative">
                        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white mb-6 shadow-sm
                          group-hover:scale-105 transition-transform duration-300">
                          {service.icon}
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 tracking-tight font-[family-name:var(--font-display)]">
                          {service.title}
                        </h2>
                        <p className="text-gray-600 leading-relaxed text-base">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className={`lg:col-span-5 flex items-center ${
                    index % 2 === 1 ? 'lg:col-start-1 lg:order-1' : 'lg:col-start-8'
                  }`}>
                    <div>
                      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-5 font-[family-name:var(--font-display)]">
                        What's Included
                      </h3>
                      <ul className="space-y-4">
                        {service.features.map((feature, fi) => (
                          <motion.li
                            key={feature}
                            className="flex items-start gap-3 group/item"
                            initial={{ opacity: 0, x: index % 2 === 1 ? -20 : 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: fi * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                              group-hover/item:bg-primary group-hover/item:text-white transition-colors duration-200">
                              <svg className="w-3.5 h-3.5 text-primary group-hover/item:text-white transition-colors" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-gray-600 leading-relaxed">{feature}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-24 lg:py-32 bg-primary relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight font-[family-name:var(--font-display)]">
              Need Help Getting Started?
            </h2>
            <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              Not sure which service is right for you? Contact us for a consultation and we'll help you determine the best path forward.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/intake"
                className="group bg-white text-primary px-8 py-4 rounded-xl text-base font-medium
                  hover:bg-gray-50 hover:shadow-lg hover:shadow-white/20 hover:-translate-y-0.5
                  transition-all duration-200 inline-flex items-center justify-center gap-2"
              >
                Start Client Intake
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/contact"
                className="bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded-xl text-base font-medium
                  hover:bg-white/10 hover:border-white/50 transition-all duration-200
                  inline-flex items-center justify-center"
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
