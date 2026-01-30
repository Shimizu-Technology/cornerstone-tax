import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FadeUp, StaggerContainer, StaggerItem, WordReveal } from '../../components/ui/MotionComponents'

const serviceCategories = [
  {
    title: 'Personal Taxes',
    description: 'Individual tax returns, W-2s, 1099s, and personal tax planning for you and your family.',
    features: ['Individual Tax Returns', 'Tax Planning', 'Prior Year Returns'],
    cta: 'Start Online Intake',
    link: '/intake',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    title: 'Business Services',
    description: 'Complete business solutions including tax returns, bookkeeping, payroll, and strategic advisory.',
    features: ['Business Tax Returns', 'Payroll & Bookkeeping', 'Business Advisory'],
    cta: 'Schedule Consultation',
    link: '/intake',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

const services = [
  {
    title: 'Tax Preparation',
    description: 'Expert personal and business tax preparation with proactive planning strategies.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Accounting Services',
    description: 'Comprehensive bookkeeping and accounting solutions tailored to your needs.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Payroll Services',
    description: 'Reliable payroll processing and compliance support for your business.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Business Advisory',
    description: 'Strategic consulting to help you grow and navigate complex financial matters.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
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
  { name: 'Education', description: 'Empowering you with financial knowledge' },
]

export default function Home() {
  useEffect(() => { document.title = 'Home | Cornerstone Accounting' }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-24 md:py-32 overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-subtle-pulse pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
        {/* Dot pattern */}
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6"
            >
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
                Guam&rsquo;s Trusted CPA Firm
              </span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              <WordReveal text="Building Strong" />
              <br />
              <span className="gradient-text">
                <WordReveal text="Financial Foundations" />
              </span>
            </h1>

            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              We believe accounting is more than numbers&mdash;it&rsquo;s about people, goals, and informed decisions. A family-operated firm dedicated to helping individuals and businesses succeed.
            </motion.p>

            <motion.p
              className="mt-4 text-base text-primary font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              Based in Guam. Built on integrity, accuracy, and trust.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to="/intake"
                className="group bg-primary text-white px-7 py-3.5 rounded-xl text-base font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 text-center min-h-[48px] flex items-center justify-center gap-2"
              >
                Get Started
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/contact"
                className="bg-white text-primary border-2 border-primary/20 px-7 py-3.5 rounded-xl text-base font-medium hover:border-primary/40 hover:bg-secondary transition-all duration-200 text-center min-h-[48px] flex items-center justify-center"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Personal vs Business */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
                Personal & Business Tax Experts
              </h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
                Whether you&rsquo;re an individual or a business owner, we have the expertise to help you succeed.
              </p>
            </div>
          </FadeUp>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {serviceCategories.map((category) => (
              <StaggerItem key={category.title}>
                <Link
                  to={category.link}
                  className="group block bg-secondary border-2 border-transparent hover:border-primary/30 rounded-2xl p-8 lg:p-10 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-sm">
                    {category.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">{category.title}</h3>
                  <p className="text-gray-600 mb-5 leading-relaxed">{category.description}</p>
                  <ul className="space-y-2.5 mb-6">
                    {category.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <span className="text-primary font-semibold inline-flex items-center gap-1.5 group-hover:gap-3 transition-all duration-300">
                    {category.cta}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* All Services Overview */}
      <section className="py-24 md:py-32 bg-gray-50 relative">
        <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <FadeUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">All Our Services</h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
                From tax preparation to business advisory, we provide comprehensive services designed to meet you where you are.
              </p>
            </div>
          </FadeUp>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {services.map((service) => (
              <StaggerItem key={service.title}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 lg:p-7 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-5">
                    {service.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 tracking-tight">{service.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{service.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <FadeUp delay={0.3} className="text-center mt-12">
            <Link
              to="/services"
              className="group text-primary font-medium hover:text-primary-dark inline-flex items-center gap-1.5 transition-colors"
            >
              View All Services
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* Why Choose Us — Editorial layout */}
      <section className="py-24 md:py-32 bg-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-32">
                <FadeUp>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mb-6">
                    Why Choose Cornerstone?
                  </h2>
                  <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                    Established by Dafne Shimizu, a Guam-licensed U.S. CPA, we&rsquo;re a family-operated firm dedicated to providing dependable, high-quality accounting services.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-5">
                    Our mission is to bring clarity, confidence, and peace of mind to our clients. We translate financial data into clear, practical insights so you can stay compliant, improve cash flow, and plan strategically.
                  </p>
                  <p className="text-primary font-medium italic text-lg">
                    Your numbers, explained clearly, every step of the way.
                  </p>
                </FadeUp>
              </div>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {values.map((value) => (
                  <StaggerItem key={value.name}>
                    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <h3 className="font-semibold text-gray-900 mb-1.5 tracking-tight">{value.name}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="bg-primary rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden">
              {/* Decorative orb */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-5 tracking-tight relative z-10">Ready to Get Started?</h2>
              <p className="text-lg opacity-90 mb-10 max-w-2xl mx-auto relative z-10">
                Whether you need help with your taxes, bookkeeping, or business planning, we&rsquo;re here to help. Fill out our intake form to begin.
              </p>
              <Link
                to="/intake"
                className="relative z-10 inline-flex items-center justify-center bg-white text-primary px-8 py-3.5 rounded-xl text-base font-medium hover:bg-gray-100 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 min-h-[48px]"
              >
                Start Client Intake Form
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
