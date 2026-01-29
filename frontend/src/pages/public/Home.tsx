import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'

/* ── Reusable scroll-reveal wrapper ── */
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

/* ── Word-by-word reveal for the hero heading ── */
function WordReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ')
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em]">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '100%', opacity: 0 },
              visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/* ── Data ── */
const serviceCategories = [
  {
    title: 'Personal Taxes',
    description: 'Individual tax returns, W-2s, 1099s, and personal tax planning for you and your family.',
    features: ['Individual Tax Returns', 'Tax Planning', 'Prior Year Returns'],
    cta: 'Start Online Intake',
    link: '/intake',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
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
      <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
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
      <svg className="w-7 h-7" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Accounting Services',
    description: 'Comprehensive bookkeeping and accounting solutions tailored to your needs.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Payroll Services',
    description: 'Reliable payroll processing and compliance support for your business.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Business Advisory',
    description: 'Strategic consulting to help you grow and navigate complex financial matters.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
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

  // Parallax for the "Why Choose Us" section
  const parallaxRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ['start end', 'end start'] })
  const parallaxY = useTransform(scrollYProgress, [0, 1], ['0%', '-8%'])

  return (
    <div className="overflow-hidden">
      {/* ═══════ Hero Section — Word reveal + gradient background ═══════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Layered background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-white to-secondary-dark" />
          {/* Decorative warm glow orbs */}
          <div className="absolute top-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#B9A39912_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium text-primary mb-8">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                Based in Guam — Built on Trust
              </span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-8 font-[family-name:var(--font-display)]">
              <WordReveal text="Your Trusted Partner in" />
              <br />
              <motion.span
                className="gradient-text"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                Financial Success
              </motion.span>
            </h1>

            <motion.p
              className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              We believe accounting is more than numbers—it's about people, goals, and informed decisions. Let us help you build a strong financial foundation.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to="/intake"
                className="group bg-primary text-white px-8 py-4 rounded-xl text-base font-medium
                  hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20
                  hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-200 text-center inline-flex items-center justify-center gap-2"
              >
                Get Started
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/contact"
                className="bg-white text-primary border-2 border-primary/20 px-8 py-4 rounded-xl text-base font-medium
                  hover:border-primary/40 hover:bg-secondary
                  transition-all duration-200 text-center"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ Personal vs Business — Two-card Section ═══════ */}
      <section className="py-24 lg:py-32 bg-white relative">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <FadeUp>
            <div className="max-w-2xl mb-16">
              <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">What We Do</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)]">
                Personal & Business{' '}
                <span className="text-accent">Tax Experts</span>
              </h2>
              <p className="mt-6 text-lg text-gray-500 leading-relaxed">
                Whether you're an individual or a business owner, we have the expertise to help you succeed.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {serviceCategories.map((category, i) => (
              <FadeUp key={category.title} delay={i * 0.1}>
                <Link
                  to={category.link}
                  className="group relative bg-secondary border-2 border-transparent hover:border-primary/20 rounded-2xl p-8 lg:p-10 transition-all duration-300 block
                    hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
                >
                  {/* Glow on hover */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/0 group-hover:bg-primary/5 rounded-full blur-3xl transition-colors duration-700" />

                  <div className="relative">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary mb-6
                      group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                      {category.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 font-[family-name:var(--font-display)]">{category.title}</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">{category.description}</p>
                    <ul className="space-y-2 mb-8">
                      {category.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <span className="text-primary font-semibold inline-flex items-center gap-2 text-sm">
                      {category.cta}
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ All Services — Bento-style Grid ═══════ */}
      <section className="py-24 lg:py-32 bg-secondary/50 relative noise-overlay">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Our Expertise</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)]">
                All Our Services
              </h2>
              <p className="mt-6 text-lg text-gray-500 leading-relaxed">
                From tax preparation to business advisory, we provide comprehensive services designed to meet you where you are.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((service, i) => (
              <FadeUp key={service.title} delay={i * 0.08}>
                <div className="group bg-white border border-neutral-warm/50 rounded-2xl p-6 lg:p-7
                  hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
                  transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary mb-5
                    group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    {service.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-[family-name:var(--font-display)]">{service.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{service.description}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.4}>
            <div className="text-center mt-12">
              <Link
                to="/services"
                className="group inline-flex items-center gap-2 text-primary font-medium hover:gap-3 transition-all duration-200"
              >
                View All Services
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ Why Choose Us — Sticky left + scrolling right (parallax) ═══════ */}
      <section ref={parallaxRef} className="py-24 lg:py-32 bg-secondary relative overflow-hidden">
        {/* Parallax background accent */}
        <motion.div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none"
          style={{ y: parallaxY }}
        />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Sticky left */}
            <FadeUp className="lg:col-span-5">
              <div className="lg:sticky lg:top-32">
                <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Why Us</span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight mb-6 font-[family-name:var(--font-display)]">
                  Why Choose Cornerstone?
                </h2>
                <p className="text-gray-500 text-lg leading-relaxed mb-4">
                  We believe accounting should empower, not overwhelm.
                </p>
                <p className="text-gray-500 leading-relaxed mb-6">
                  Our approach is hands-on, collaborative, and tailored to each client's unique needs. We translate financial data into clear, practical insights so our clients can stay compliant, improve cash flow, and plan strategically with confidence.
                </p>
                <p className="text-primary font-medium italic">
                  Your numbers, explained clearly, every step of the way.
                </p>
              </div>
            </FadeUp>

            {/* Scrolling right — value cards */}
            <div className="lg:col-span-6 lg:col-start-7 space-y-4">
              {values.map((value, i) => (
                <FadeUp key={value.name} delay={i * 0.08}>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-warm/30
                    hover:shadow-md hover:border-primary/10 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm font-[family-name:var(--font-display)]">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1 font-[family-name:var(--font-display)]">{value.name}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CTA Section — Overlapping card ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <FadeUp>
            <div className="relative bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-10 md:p-16 text-center text-white overflow-hidden">
              {/* Decorative orbs */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

              <div className="relative">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 tracking-tight font-[family-name:var(--font-display)]">
                  Ready to Get Started?
                </h2>
                <p className="text-lg opacity-90 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Whether you need help with your taxes, bookkeeping, or business planning, we're here to help. Fill out our intake form to begin.
                </p>
                <Link
                  to="/intake"
                  className="group inline-flex items-center justify-center gap-2 bg-white text-primary px-8 py-4 rounded-xl text-base font-medium
                    hover:bg-gray-50 hover:shadow-lg hover:shadow-white/20 hover:-translate-y-0.5
                    transition-all duration-200"
                >
                  Start Client Intake Form
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
