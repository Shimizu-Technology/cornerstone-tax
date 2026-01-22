import { Link } from 'react-router-dom'

const services = [
  {
    title: 'Tax Preparation',
    description: 'Expert personal and business tax preparation with proactive planning strategies.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Accounting Services',
    description: 'Comprehensive bookkeeping and accounting solutions tailored to your needs.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Payroll Services',
    description: 'Reliable payroll processing and compliance support for your business.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Business Advisory',
    description: 'Strategic consulting to help you grow and navigate complex financial matters.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
]

const values = [
  { name: 'Integrity', description: 'Honest and transparent in all we do' },
  { name: 'Accuracy', description: 'Precision in every calculation' },
  { name: 'Client Partnership', description: 'Your success is our success' },
  { name: 'Responsiveness', description: 'Always here when you need us' },
  { name: 'Competence', description: 'Decades of expertise you can trust' },
]

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-secondary to-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Your Trusted Partner in{' '}
              <span className="text-primary">Financial Success</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed">
              We believe accounting is more than numbers—it's about people, goals, and informed decision-making. Let us help you build a strong financial foundation.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                to="/intake"
                className="bg-primary text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-primary-dark transition-colors text-center min-h-[48px] flex items-center justify-center"
              >
                Start Your Tax Return
              </Link>
              <Link
                to="/contact"
                className="bg-white text-primary border-2 border-primary px-6 py-3 rounded-lg text-base font-medium hover:bg-secondary transition-colors text-center min-h-[48px] flex items-center justify-center"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">How We Can Help</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              From tax preparation to business advisory, we provide comprehensive services designed to meet you where you are.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <div
                key={service.title}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 bg-secondary rounded-lg flex items-center justify-center text-primary mb-4">
                  {service.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              to="/services"
              className="text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              View All Services
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why Choose Cornerstone?
              </h2>
              <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                We believe accounting should empower, not overwhelm. Our approach is hands-on, collaborative, and tailored to each client's unique needs.
              </p>
              <p className="text-gray-600 leading-relaxed">
                We translate financial data into clear insights so you can stay compliant, improve cash flow, and plan strategically for the future.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.map((value) => (
                <div key={value.name} className="bg-white rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-1">{value.name}</h3>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary rounded-2xl p-8 md:p-12 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Whether you need help with your taxes, bookkeeping, or business planning, we're here to help. Fill out our intake form to begin.
            </p>
            <Link
              to="/intake"
              className="inline-flex items-center justify-center bg-white text-primary px-8 py-3 rounded-lg text-base font-medium hover:bg-gray-100 transition-colors min-h-[48px]"
            >
              Start Client Intake Form
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
