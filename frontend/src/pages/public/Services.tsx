import { Link } from 'react-router-dom'

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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
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
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
]

export default function Services() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-secondary to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Our Services</h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
            </p>
            <p className="mt-4 text-base text-primary font-medium italic">
              Reliable support. Clear insights. Thoughtful guidance.
            </p>
          </div>
        </div>
      </section>

      {/* Services List */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {services.map((service, index) => (
              <div
                key={service.title}
                className={`flex flex-col lg:flex-row gap-8 ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className="lg:w-1/2">
                  <div className="bg-secondary rounded-2xl p-8 h-full">
                    <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-white mb-6">
                      {service.icon}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{service.title}</h2>
                    <p className="text-gray-600 leading-relaxed">{service.description}</p>
                  </div>
                </div>
                <div className="lg:w-1/2 flex items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Included:</h3>
                    <ul className="space-y-3">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Need Help Getting Started?</h2>
          <p className="text-white opacity-90 mb-8 max-w-2xl mx-auto">
            Not sure which service is right for you? Contact us for a consultation and we'll help you determine the best path forward.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/intake"
              className="bg-white text-primary px-6 py-3 rounded-lg text-base font-medium hover:bg-gray-100 transition-colors min-h-[48px] flex items-center justify-center"
            >
              Start Client Intake
            </Link>
            <Link
              to="/contact"
              className="bg-transparent text-white border-2 border-white px-6 py-3 rounded-lg text-base font-medium hover:bg-white/10 transition-colors min-h-[48px] flex items-center justify-center"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
