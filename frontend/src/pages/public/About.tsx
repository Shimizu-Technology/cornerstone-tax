import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FadeUp, StaggerContainer, StaggerItem } from '../../components/ui/MotionComponents'

const values = [
  {
    name: 'Integrity',
    description: 'We operate with honesty and transparency in everything we do, building trust through ethical practices.',
  },
  {
    name: 'Accuracy',
    description: 'Precision matters. We take pride in delivering meticulous work you can rely on.',
  },
  {
    name: 'Client Partnership',
    description: 'Your success is our success. We work alongside you as a true partner in your financial journey.',
  },
  {
    name: 'Responsiveness',
    description: 'We understand time is valuable. Expect prompt, attentive service whenever you need us.',
  },
  {
    name: 'Education',
    description: 'We empower our clients with knowledge, helping them understand their finances and make informed decisions.',
  },
]

export default function About() {
  useEffect(() => { document.title = 'About Us | Cornerstone Accounting' }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.span
              className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Our Story
            </motion.span>
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              About <span className="gradient-text">Us</span>
            </motion.h1>
            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
            </motion.p>
            <motion.p
              className="mt-4 text-base text-primary font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Based in Guam. Built on integrity, accuracy, and trust.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Our Story — Editorial Layout */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Sticky heading */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-32">
                <FadeUp>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">What We Do</h2>
                  <div className="w-16 h-1 bg-primary rounded-full mt-4" />
                </FadeUp>
              </div>
            </div>
            {/* Content */}
            <div className="lg:col-span-7 lg:col-start-6">
              <FadeUp delay={0.1}>
                <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
                  <p>
                    We provide income tax preparation, accounting, consulting, and payroll services, with a focus on clarity, accuracy, and dependable guidance. Our goal is to support confident decision-making and long-term financial success.
                  </p>
                  <p>
                    We go beyond compliance to meet our clients where they are, whether they&rsquo;re starting a business, growing operations, or navigating complex financial and tax matters.
                  </p>
                  <p className="font-medium text-gray-800">
                    At Cornerstone, we believe accounting is more than numbers&mdash;it&rsquo;s about people, goals, and informed decisions.
                  </p>
                </div>
              </FadeUp>
            </div>
          </div>

          {/* Founder Card */}
          <FadeUp className="mt-20">
            <div className="bg-secondary rounded-3xl p-8 lg:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-3 flex justify-center lg:justify-start">
                  <div className="w-32 h-32 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-4xl">DS</span>
                  </div>
                </div>
                <div className="lg:col-span-9">
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Dafne Shimizu, CPA</h3>
                  <p className="text-primary font-medium mb-4">Founder & Owner</p>
                  <div className="text-gray-600 text-sm leading-relaxed space-y-3">
                    <p>
                      Dafne Shimizu is a U.S.-licensed CPA born and raised on Guam. A proud Triton, she earned her bachelor&rsquo;s degree in Accounting and her master&rsquo;s degree in Public Administration.
                    </p>
                    <p>
                      With over 30 years of accounting experience, including managerial and executive leadership, Dafne brings thoughtful, dependable guidance to every client relationship.
                    </p>
                    <p>
                      Raised in the village of Merizo, her values were shaped by her parents, Felix and Dot Mansapit, who instilled the importance of hard work, education, and integrity.
                    </p>
                    <p className="italic text-gray-700">
                      At the core of her work is a simple belief: accounting should support people, not overwhelm them.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 md:py-32 bg-gray-50 relative">
        <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <StaggerItem>
              <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-sm h-full">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Our Mission</h3>
                <p className="text-gray-600 leading-relaxed">
                  We are a family-operated firm based in Guam, established by Dafne Shimizu, U.S.-licensed CPA, with a mission to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients.
                </p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-sm h-full">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Our Vision</h3>
                <p className="text-gray-600 leading-relaxed">
                  To be a trusted cornerstone for individuals and businesses&mdash;recognized for excellence, integrity, and meaningful client relationships.
                </p>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">Our Core Values</h2>
              <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
                These values shape how we work and how we serve our community.
              </p>
            </div>
          </FadeUp>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <StaggerItem
                key={value.name}
                className={index === values.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}
              >
                <div className="bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300 hover:-translate-y-1 h-full">
                  <span className="text-xs font-bold text-primary/40 tracking-widest">0{index + 1}</span>
                  <h3 className="text-lg font-bold text-primary mt-2 mb-2 tracking-tight">{value.name}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{value.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 bg-secondary">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-5 tracking-tight">Ready to Work Together?</h2>
              <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-lg">
                We&rsquo;d love to learn more about your needs and how we can help you achieve your financial goals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/contact"
                  className="group bg-primary text-white px-7 py-3.5 rounded-xl text-base font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 min-h-[48px] flex items-center justify-center gap-2"
                >
                  Contact Us
                  <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  to="/services"
                  className="bg-white text-primary border-2 border-primary/20 px-7 py-3.5 rounded-xl text-base font-medium hover:border-primary/40 hover:bg-white transition-all duration-200 min-h-[48px] flex items-center justify-center"
                >
                  View Our Services
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
