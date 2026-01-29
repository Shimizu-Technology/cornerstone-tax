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

const values = [
  { name: 'Integrity', description: 'We operate with honesty and transparency in everything we do, building trust through ethical practices.' },
  { name: 'Accuracy', description: 'Precision matters. We take pride in delivering meticulous work you can rely on.' },
  { name: 'Client Partnership', description: 'Your success is our success. We work alongside you as a true partner in your financial journey.' },
  { name: 'Responsiveness', description: 'We understand time is valuable. Expect prompt, attentive service whenever you need us.' },
  { name: 'Education', description: 'We empower our clients with knowledge, helping them understand their finances and make informed decisions.' },
]

export default function About() {
  useEffect(() => { document.title = 'About Us | Cornerstone Accounting' }, [])

  return (
    <div className="overflow-hidden">
      {/* ═══════ Hero ═══════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-white to-secondary-dark" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#B9A39912_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Our Story</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6 font-[family-name:var(--font-display)]">
              About Us
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
              Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
            </p>
            <p className="mt-4 text-base text-primary font-medium">
              Based in Guam. Built on integrity, accuracy, and trust.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ What We Do — Editorial Layout with sticky heading ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Sticky left heading */}
            <FadeUp className="lg:col-span-4">
              <div className="lg:sticky lg:top-32">
                <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">What We Do</span>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)]">
                  More than numbers—it's about{' '}
                  <span className="text-accent">people</span>
                </h2>
              </div>
            </FadeUp>

            {/* Right content */}
            <div className="lg:col-span-7 lg:col-start-6">
              <FadeUp delay={0.1}>
                <div className="space-y-6 text-gray-600 leading-relaxed text-lg">
                  <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-primary first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                    We provide income tax preparation, accounting, consulting, and payroll services, with a focus on clarity, accuracy, and dependable guidance. Our goal is to support confident decision-making and long-term financial success.
                  </p>
                  <p>
                    We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
                  </p>
                  <p className="text-primary font-medium italic border-l-2 border-primary pl-6">
                    At Cornerstone, we believe accounting is more than numbers—it's about people, goals, and informed decisions.
                  </p>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Founder — Asymmetric Layout ═══════ */}
      <section className="py-24 lg:py-32 bg-secondary/50 relative noise-overlay">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <FadeUp>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Founder card — visually offset */}
              <div className="lg:col-span-5 lg:col-start-1">
                <div className="relative bg-white rounded-3xl p-8 lg:p-10 shadow-sm border border-neutral-warm/30">
                  <div className="text-center mb-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                      <span className="text-white font-bold text-3xl font-[family-name:var(--font-display)]">DS</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">Dafne Shimizu, CPA</h3>
                    <p className="text-primary font-medium text-sm">Founder & Owner</p>
                  </div>
                  <div className="text-gray-600 text-sm leading-relaxed space-y-3">
                    <p>
                      Dafne Shimizu is a U.S.-licensed CPA born and raised on Guam. A proud Triton, she earned her bachelor's degree in Accounting and her master's degree in Public Administration.
                    </p>
                    <p>
                      With over 30 years of accounting experience, including managerial and executive leadership, Dafne brings thoughtful, dependable guidance to every client relationship.
                    </p>
                    <p>
                      Raised in the village of Merizo, her values were shaped by her parents, Felix and Dot Mansapit, who instilled the importance of hard work, education, and integrity.
                    </p>
                    <p className="italic text-primary border-t border-neutral-warm/50 pt-3 mt-4">
                      At the core of her work is a simple belief: accounting should support people, not overwhelm them.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mission & Vision — stacked on the right */}
              <div className="lg:col-span-6 lg:col-start-7 space-y-6">
                <FadeUp delay={0.1}>
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-warm/30 hover:shadow-md hover:border-primary/10 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 font-[family-name:var(--font-display)]">Our Mission</h3>
                        <p className="text-gray-600 leading-relaxed">
                          We are a family-operated firm based in Guam, established by Dafne Shimizu, U.S.-licensed CPA, with a mission to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients.
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeUp>

                <FadeUp delay={0.2}>
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-warm/30 hover:shadow-md hover:border-primary/10 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 font-[family-name:var(--font-display)]">Our Vision</h3>
                        <p className="text-gray-600 leading-relaxed">
                          To be a trusted cornerstone for individuals and businesses—recognized for excellence, integrity, and meaningful client relationships.
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ Core Values — Staggered grid ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Our Values</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)]">
                Our Core Values
              </h2>
              <p className="mt-6 text-gray-500 text-lg leading-relaxed">
                These values shape how we work and how we serve our community.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((value, i) => (
              <FadeUp key={value.name} delay={i * 0.08}>
                <div className={`group bg-white border border-neutral-warm/50 rounded-2xl p-7
                  hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
                  transition-all duration-300 hover:-translate-y-1 h-full
                  ${i === values.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-primary font-bold text-xs font-[family-name:var(--font-display)]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-primary font-[family-name:var(--font-display)]">{value.name}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{value.description}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-24 lg:py-32 bg-secondary relative overflow-hidden">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 tracking-tight font-[family-name:var(--font-display)]">
              Ready to Work Together?
            </h2>
            <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              We'd love to learn more about your needs and how we can help you achieve your financial goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="group bg-primary text-white px-8 py-4 rounded-xl text-base font-medium
                  hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5
                  transition-all duration-200 inline-flex items-center justify-center gap-2"
              >
                Contact Us
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/services"
                className="bg-white text-primary border-2 border-primary/20 px-8 py-4 rounded-xl text-base font-medium
                  hover:border-primary/40 hover:bg-white transition-all duration-200 inline-flex items-center justify-center"
              >
                View Our Services
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
