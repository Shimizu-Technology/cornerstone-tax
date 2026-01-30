import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { FadeUp, StaggerContainer, StaggerItem } from '../../components/ui/MotionComponents'

const contactInfo = [
  {
    title: 'Office Location',
    content: '130 Aspinall Ave, Suite 202\nHagatna, Guam',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Phone',
    content: 'Office: (671) 828-8591\nCell: (671) 482-8671',
    extra: 'Also available via WhatsApp',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    title: 'Email',
    content: 'dmshimizucpa@gmail.com',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Business Hours',
    content: 'Monday - Friday: 8:00 AM - 5:00 PM\nSaturday: 9:00 AM - 1:00 PM\nSunday: Closed',
    extra: 'Holiday hours may vary. Please contact us to confirm availability.',
    icon: (
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

/** Floating label input */
function FloatingInput({ label, id, required, type = 'text', ...props }: {
  label: string
  id: string
  required?: boolean
  type?: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={type}
        required={required}
        placeholder=" "
        className="floating-input peer w-full px-4 pt-6 pb-2 bg-white border border-gray-200 rounded-xl text-gray-900 transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
      />
      <label
        htmlFor={id}
        className="floating-label absolute left-4 top-4 text-gray-400 pointer-events-none"
      >
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    </div>
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

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Message Sent!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for reaching out. We&rsquo;ll get back to you as soon as possible.
          </p>
          <Link
            to="/"
            className="text-primary font-medium hover:text-primary-dark transition-colors"
          >
            Return to Home
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
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
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Contact <span className="gradient-text">Us</span>
            </motion.h1>
            <motion.p
              className="mt-6 text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              Have questions or ready to get started? We&rsquo;d love to hear from you. Reach out and let&rsquo;s discuss how we can help with your financial needs.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Contact Form */}
            <div className="lg:col-span-7">
              <FadeUp>
                <h2 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">Send Us a Message</h2>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <FloatingInput
                    label="Name"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FloatingInput
                      label="Email"
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                    <FloatingInput
                      label="Phone"
                      id="phone"
                      name="phone"
                      type="tel"
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
                      className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none appearance-none"
                    >
                      <option value="">Select a subject *</option>
                      <option value="tax-preparation">Tax Preparation</option>
                      <option value="accounting">Accounting Services</option>
                      <option value="payroll">Payroll Services</option>
                      <option value="consulting">Business Consulting</option>
                      <option value="other">Other</option>
                    </select>
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                      className="floating-input peer w-full px-4 pt-6 pb-3 bg-white border border-gray-200 rounded-xl text-gray-900 transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                    />
                    <label
                      htmlFor="message"
                      className="floating-label absolute left-4 top-4 text-gray-400 pointer-events-none"
                    >
                      Message<span className="text-red-400 ml-0.5">*</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group w-full bg-primary text-white px-6 py-3.5 rounded-xl text-base font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 min-h-[48px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                  </button>
                </form>
              </FadeUp>
            </div>

            {/* Contact Info */}
            <div className="lg:col-span-5">
              <FadeUp delay={0.2}>
                <h2 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">Get in Touch</h2>
              </FadeUp>

              <StaggerContainer className="space-y-6">
                {contactInfo.map((item) => (
                  <StaggerItem key={item.title}>
                    <div className="flex gap-4 p-5 bg-white border border-gray-100 rounded-2xl hover:shadow-md hover:shadow-gray-100 transition-all duration-300">
                      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-gray-600 text-sm whitespace-pre-line">{item.content}</p>
                        {item.extra && (
                          <p className="text-xs text-gray-400 mt-2">{item.extra}</p>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>

              {/* Quick Link */}
              <FadeUp delay={0.4} className="mt-8">
                <div className="p-6 bg-secondary rounded-2xl">
                  <h3 className="font-semibold text-gray-900 mb-2">Ready to get started?</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    If you&rsquo;re ready to begin, fill out our client intake form to start the process.
                  </p>
                  <Link
                    to="/intake"
                    className="group inline-flex items-center gap-2 text-primary font-medium hover:text-primary-dark transition-colors"
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
      </section>
    </div>
  )
}
