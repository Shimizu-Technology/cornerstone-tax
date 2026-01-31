import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FadeUp } from '../../components/ui/MotionComponents'

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
  },
]

export default function Services() {
  useEffect(() => { document.title = 'Services | Cornerstone Accounting' }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.span
              className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              What We Offer
            </motion.span>
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Our <span className="gradient-text">Services</span>
            </motion.h1>
            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              We go beyond compliance to meet our clients where they are, whether they&rsquo;re starting a business, growing operations, or navigating complex financial and tax matters.
            </motion.p>
            <motion.p
              className="mt-4 text-base text-primary font-medium italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Reliable support. Clear insights. Thoughtful guidance.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Services List — Numbered editorial layout */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-20 lg:space-y-28">
            {services.map((service, index) => (
              <FadeUp key={service.title}>
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start ${
                  index % 2 === 1 ? 'lg:direction-rtl' : ''
                }`}>
                  {/* Number + Service info */}
                  <div className={`lg:col-span-7 ${index % 2 === 1 ? 'lg:col-start-6 lg:order-2' : ''}`}>
                    <div className="bg-secondary rounded-3xl p-8 lg:p-10">
                      <div className="flex items-start gap-5 mb-5">
                        <span className="text-5xl lg:text-6xl font-bold text-primary/15 tracking-tighter leading-none select-none">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{service.title}</h2>
                        </div>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-lg">{service.description}</p>
                    </div>
                  </div>
                  {/* Features */}
                  <div className={`lg:col-span-5 flex items-center ${index % 2 === 1 ? 'lg:col-start-1 lg:order-1' : ''}`}>
                    <div className="w-full">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">What&rsquo;s Included</h3>
                      <ul className="space-y-3">
                        {service.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <svg
                              className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              aria-hidden="true" viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="text-gray-600">{feature}</span>
                          </li>
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

      {/* CTA */}
      <section className="py-24 md:py-32 bg-primary relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <FadeUp>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-5 tracking-tight">Need Help Getting Started?</h2>
            <p className="text-white/85 mb-10 max-w-2xl mx-auto text-lg">
              Not sure which service is right for you? Contact us for a consultation and we&rsquo;ll help you determine the best path forward.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/intake"
                className="bg-white text-primary px-7 py-3.5 rounded-xl text-base font-medium hover:bg-gray-100 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 min-h-[48px] flex items-center justify-center"
              >
                Start Client Intake
              </Link>
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
