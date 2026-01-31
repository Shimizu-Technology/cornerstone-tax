import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'

const EASE = [0.22, 1, 0.36, 1] as const

/* ─── Floating Label Input ─── */
function FloatingInput({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        {...props}
        placeholder=" "
        className="
          peer w-full px-4 pt-6 pb-2 bg-gray-50
          border border-gray-200 rounded-xl
          text-gray-900
          transition-colors duration-200
          focus:border-primary focus:ring-1 focus:ring-primary
          focus:outline-none
        "
      />
      <label className="
        absolute left-4 top-4 text-gray-400
        transition-all duration-200 pointer-events-none
        peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary
        peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs
      ">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    </div>
  )
}

/* ─── Floating Label Select ─── */
function FloatingSelect({
  label,
  required,
  children,
  value,
  ...props
}: { label: string; required?: boolean; children: React.ReactNode; value: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'>) {
  return (
    <div className="relative">
      <select
        {...props}
        value={value}
        className={`
          peer w-full px-4 pt-6 pb-2 bg-gray-50
          border border-gray-200 rounded-xl
          transition-colors duration-200
          focus:border-primary focus:ring-1 focus:ring-primary
          focus:outline-none appearance-none
          ${value ? 'text-gray-900' : 'text-transparent'}
        `}
      >
        {children}
      </select>
      <label className={`
        absolute left-4 text-gray-400
        transition-all duration-200 pointer-events-none
        ${value ? 'top-2 text-xs' : 'top-4 text-base'}
        peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary
      `}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {/* Chevron */}
      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

/* ─── Floating Label Textarea ─── */
function FloatingTextarea({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="relative">
      <textarea
        {...props}
        placeholder=" "
        className="
          peer w-full px-4 pt-6 pb-2 bg-gray-50
          border border-gray-200 rounded-xl
          text-gray-900
          transition-colors duration-200
          focus:border-primary focus:ring-1 focus:ring-primary
          focus:outline-none resize-none
        "
      />
      <label className="
        absolute left-4 top-4 text-gray-400
        transition-all duration-200 pointer-events-none
        peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary
        peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs
      ">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    </div>
  )
}

/* ─── Fade Up on Scroll ─── */
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Contact Info Item ─── */
function ContactItem({ icon, title, children, delay = 0 }: { icon: React.ReactNode; title: string; children: React.ReactNode; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="flex gap-5"
    >
      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 tracking-tight">{title}</h3>
        <div className="text-gray-600 mt-1">{children}</div>
      </div>
    </motion.div>
  )
}

export default function Contact() {
  useEffect(() => { document.title = 'Contact | Cornerstone Accounting' }, [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
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
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      subject: formData.subject,
      message: formData.message,
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSubmitted(true)
    }
  }

  /* ─── Success State ─── */
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <motion.div
            className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
          >
            <motion.svg
              className="w-10 h-10 text-green-500"
              fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </motion.svg>
          </motion.div>
          <motion.h2
            className="text-3xl font-bold text-gray-900 mb-3 tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Message Sent!
          </motion.h2>
          <motion.p
            className="text-gray-500 mb-8 text-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Thank you for reaching out. We&rsquo;ll get back to you as soon as possible.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary font-medium hover:underline text-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Return to Home
            </Link>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.span
              className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Get in Touch
            </motion.span>
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            >
              Contact <span className="gradient-text">Us</span>
            </motion.h1>
            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            >
              Have questions or ready to get started? We&rsquo;d love to hear from you. Reach out and let&rsquo;s discuss how we can help with your financial needs.
            </motion.p>
            <motion.p
              className="mt-4 text-base text-primary font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Based in Hagatna, Guam. Available by phone, email, or WhatsApp.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ─── Contact Content ─── */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

            {/* ─── Form Column ─── */}
            <div className="lg:col-span-7">
              <FadeUp>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 tracking-tight">Send Us a Message</h2>
                <p className="text-gray-500 mb-10">Fill out the form below and we&rsquo;ll respond within one business day.</p>
              </FadeUp>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
                  >
                    <p className="text-red-600 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.form
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              >
                <FloatingInput
                  label="Name"
                  required
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FloatingInput
                    label="Email"
                    required
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
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

                <FloatingSelect
                  label="Subject"
                  required
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                >
                  <option value="">Select a subject</option>
                  <option value="tax-preparation">Tax Preparation</option>
                  <option value="accounting">Accounting Services</option>
                  <option value="payroll">Payroll Services</option>
                  <option value="consulting">Business Consulting</option>
                  <option value="other">Other</option>
                </FloatingSelect>

                <FloatingTextarea
                  label="Message"
                  required
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={5}
                />

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="group w-full bg-primary text-white px-7 py-4 rounded-xl text-base font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 min-h-[48px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" aria-hidden="true" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <svg className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </>
                  )}
                </motion.button>
              </motion.form>
            </div>

            {/* ─── Info Column ─── */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-32">
                <FadeUp delay={0.1}>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 tracking-tight">Get in Touch</h2>
                  <div className="w-12 h-1 bg-primary rounded-full mb-10" />
                </FadeUp>

                <div className="space-y-7">
                  <ContactItem
                    delay={0.15}
                    title="Office Location"
                    icon={<svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  >
                    <p>130 Aspinall Ave, Suite 202<br />Hagatna, Guam</p>
                  </ContactItem>

                  <ContactItem
                    delay={0.2}
                    title="Phone"
                    icon={<svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                  >
                    <p>
                      Office: <a href="tel:+16718288591" className="hover:text-primary transition-colors">(671) 828-8591</a><br />
                      Cell: <a href="tel:+16714828671" className="hover:text-primary transition-colors">(671) 482-8671</a>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Also available via WhatsApp</p>
                  </ContactItem>

                  <ContactItem
                    delay={0.25}
                    title="Email"
                    icon={<svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                  >
                    <a href="mailto:dmshimizucpa@gmail.com" className="hover:text-primary transition-colors">dmshimizucpa@gmail.com</a>
                  </ContactItem>

                  <ContactItem
                    delay={0.3}
                    title="Business Hours"
                    icon={<svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  >
                    <p>
                      Monday \u2013 Friday: 8:00 AM \u2013 5:00 PM<br />
                      Saturday: 9:00 AM \u2013 1:00 PM<br />
                      Sunday: Closed
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Holiday hours may vary. Please contact us to confirm availability.</p>
                  </ContactItem>
                </div>

                {/* Intake CTA card */}
                <FadeUp delay={0.35} className="mt-10">
                  <div className="bg-secondary rounded-2xl p-7">
                    <h3 className="font-bold text-gray-900 mb-2 tracking-tight">Ready to get started?</h3>
                    <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                      If you\u2019re ready to begin, fill out our client intake form to start the process.
                    </p>
                    <Link
                      to="/intake"
                      className="group inline-flex items-center gap-2 text-primary font-medium hover:underline"
                    >
                      Go to Intake Form
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </FadeUp>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
