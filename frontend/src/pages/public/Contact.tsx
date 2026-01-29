import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { api } from '../../lib/api'

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

/* ── Floating label input ── */
function FloatingInput({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        {...props}
        placeholder=" "
        className="peer w-full px-4 pt-6 pb-2 bg-white border border-neutral-warm/60 rounded-xl
          text-gray-900 transition-all duration-200
          focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
          hover:border-primary/40"
      />
      <label className="absolute left-4 top-4 text-gray-400 text-sm transition-all duration-200 pointer-events-none
        peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary
        peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    </div>
  )
}

const contactDetails = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Office Location',
    content: (
      <p>130 Aspinall Ave, Suite 202<br />Hagatna, Guam</p>
    ),
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    title: 'Phone',
    content: (
      <div>
        <p>Office: <a href="tel:+16718288591" className="hover:text-primary transition-colors">(671) 828-8591</a></p>
        <p>Cell: <a href="tel:+16714828671" className="hover:text-primary transition-colors">(671) 482-8671</a></p>
        <p className="text-xs text-gray-400 mt-1">Also available via WhatsApp</p>
      </div>
    ),
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Email',
    content: (
      <a href="mailto:dmshimizucpa@gmail.com" className="hover:text-primary transition-colors">dmshimizucpa@gmail.com</a>
    ),
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Business Hours',
    content: (
      <div>
        <p>Monday – Friday: 8:00 AM – 5:00 PM</p>
        <p>Saturday: 9:00 AM – 1:00 PM</p>
        <p>Sunday: Closed</p>
        <p className="text-xs text-gray-400 mt-1">Holiday hours may vary. Please contact us to confirm availability.</p>
      </div>
    ),
  },
]

export default function Contact() {
  useEffect(() => { document.title = 'Contact | Cornerstone Accounting' }, [])

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', subject: '', message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    const result = await api.submitContact({
      name: formData.name, email: formData.email,
      phone: formData.phone || undefined, subject: formData.subject, message: formData.message,
    })
    setIsSubmitting(false)
    if (result.error) { setError(result.error) } else { setSubmitted(true) }
  }

  /* ── Success State ── */
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <motion.svg
              className="w-10 h-10 text-green-500"
              fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </motion.svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 font-[family-name:var(--font-display)]">Message Sent!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Thank you for reaching out. We'll get back to you as soon as possible.
          </p>
          <Link to="/" className="text-primary font-medium hover:underline inline-flex items-center gap-2 group">
            Return to Home
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* ═══════ Hero ═══════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-white to-secondary-dark" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#B9A39912_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">Get In Touch</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6 font-[family-name:var(--font-display)]">
              Contact Us
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
              Have questions or ready to get started? We'd love to hear from you. Reach out and let's discuss how we can help with your financial needs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ Form + Info — Asymmetric grid ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Contact Form */}
            <FadeUp className="lg:col-span-7">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 font-[family-name:var(--font-display)]">Send Us a Message</h2>
                <p className="text-gray-400 text-sm mb-8">We'll respond within one business day.</p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <p className="text-red-600 text-sm">{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <FloatingInput
                    label="Name"
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FloatingInput
                      label="Email"
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                    <FloatingInput
                      label="Phone"
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="relative">
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-4 bg-white border border-neutral-warm/60 rounded-xl
                        text-gray-900 transition-all duration-200 appearance-none
                        focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
                        hover:border-primary/40"
                    >
                      <option value="">Select a subject</option>
                      <option value="tax-preparation">Tax Preparation</option>
                      <option value="accounting">Accounting Services</option>
                      <option value="payroll">Payroll Services</option>
                      <option value="consulting">Business Consulting</option>
                      <option value="other">Other</option>
                    </select>
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  <div className="relative">
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      placeholder=" "
                      className="peer w-full px-4 pt-6 pb-2 bg-white border border-neutral-warm/60 rounded-xl
                        text-gray-900 transition-all duration-200 resize-none
                        focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
                        hover:border-primary/40"
                    />
                    <label className="absolute left-4 top-4 text-gray-400 text-sm transition-all duration-200 pointer-events-none
                      peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary
                      peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs">
                      Message<span className="text-red-400 ml-0.5">*</span>
                    </label>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="group w-full bg-primary text-white px-6 py-4 rounded-xl text-base font-medium
                      hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20
                      transition-all duration-200 flex items-center justify-center gap-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" aria-hidden="true" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </FadeUp>

            {/* Contact Info */}
            <div className="lg:col-span-4 lg:col-start-9">
              <FadeUp delay={0.1}>
                <h2 className="text-2xl font-bold text-gray-900 mb-8 font-[family-name:var(--font-display)]">Get in Touch</h2>
              </FadeUp>

              <div className="space-y-6">
                {contactDetails.map((item, i) => (
                  <FadeUp key={item.title} delay={0.15 + i * 0.08}>
                    <div className="flex gap-4 group">
                      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0 text-primary
                        group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1 text-sm font-[family-name:var(--font-display)]">{item.title}</h3>
                        <div className="text-gray-500 text-sm leading-relaxed">{item.content}</div>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>

              {/* Quick CTA card */}
              <FadeUp delay={0.5}>
                <div className="mt-10 p-6 bg-gradient-to-br from-secondary to-secondary-dark rounded-2xl border border-neutral-warm/30">
                  <h3 className="font-semibold text-gray-900 mb-2 font-[family-name:var(--font-display)]">Ready to get started?</h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                    If you're ready to begin, fill out our client intake form to start the process.
                  </p>
                  <Link
                    to="/intake"
                    className="inline-flex items-center gap-2 text-primary font-medium text-sm group/link"
                  >
                    Go to Intake Form
                    <svg className="w-4 h-4 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
