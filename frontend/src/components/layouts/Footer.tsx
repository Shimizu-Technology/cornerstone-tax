import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const footerLinks = [
  { name: 'About Us', href: '/about' },
  { name: 'Our Services', href: '/services' },
  { name: 'Contact', href: '/contact' },
  { name: 'Client Intake Form', href: '/intake' },
]

const contactInfo = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    text: '130 Aspinall Ave, Suite 202',
    subtext: 'Hagatna, Guam',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    text: '(671) 828-8591',
    href: 'tel:+16718288591',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    text: 'dmshimizucpa@gmail.com',
    href: 'mailto:dmshimizucpa@gmail.com',
  },
]

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-10%" })

  return (
    <footer ref={ref} className="relative bg-gray-900 text-white overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-primary/10 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-8">
        {/* Main Footer Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand Column */}
          <div className="lg:col-span-5">
            <div className="mb-6 bg-white rounded-lg px-3 py-2 w-fit">
              <img
                src="/logo.jpeg"
                alt="Cornerstone Accounting & Business Management"
                className="h-14 w-auto object-contain"
              />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
            </p>
            <p className="text-gray-500 text-sm mt-4 italic">
              Based in Guam. Built on integrity, accuracy, and trust.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-5 font-[family-name:var(--font-display)]">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors duration-200 inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 h-px bg-white transition-all duration-200 group-hover:w-3" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-5 font-[family-name:var(--font-display)]">
              Contact Us
            </h3>
            <ul className="space-y-4">
              {contactInfo.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-accent mt-0.5 flex-shrink-0">
                    {item.icon}
                  </span>
                  <div className="text-sm text-gray-400">
                    {item.href ? (
                      <a href={item.href} className="hover:text-white transition-colors duration-200">
                        {item.text}
                      </a>
                    ) : (
                      <>
                        <span>{item.text}</span>
                        {item.subtext && <span className="block text-gray-500">{item.subtext}</span>}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {currentYear} Cornerstone Accounting & Business Services. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            Crafted with care in Guam 🌺
          </p>
        </div>
      </div>
    </footer>
  )
}
