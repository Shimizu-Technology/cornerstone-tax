import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { SignedIn, UserButton } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'

const navigation = [
  { name: 'Dashboard', href: '/portal' },
  { name: 'My Returns', href: '/portal/returns' },
  { name: 'Documents', href: '/portal/documents' },
]

export default function PortalLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const currentYear = new Date().getFullYear()

  const isActive = (href: string) => {
    if (href === '/portal') return location.pathname === '/portal'
    return location.pathname.startsWith(href)
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mobileMenuOpen])

  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-secondary">
      {/* Header — matches main site pattern */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-lg shadow-sm border-b border-neutral-warm/30'
            : 'bg-white'
        }`}
      >
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/portal" className="flex items-center flex-shrink-0">
            <div className="h-14 sm:h-16 overflow-hidden flex items-center">
              <img
                src="/logo.jpeg"
                alt="Cornerstone Accounting & Business Management"
                className="h-28 sm:h-32 w-auto max-w-none object-contain"
              />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 h-full">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="relative h-full inline-flex items-center text-sm font-medium transition-colors group"
              >
                <span className={isActive(item.href) ? 'text-primary' : 'text-gray-600 group-hover:text-primary transition-colors'}>
                  {item.name}
                </span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ${
                    isActive(item.href) ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            ))}
            <Link
              to="/"
              className="h-full inline-flex items-center text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Main Website
            </Link>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: "w-9 h-9" } }}
              />
            </SignedIn>
          </div>

          {/* Mobile right side */}
          <div className="flex items-center md:hidden gap-2">
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: "w-9 h-9" } }}
              />
            </SignedIn>
            <button
              type="button"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t bg-white/95 backdrop-blur-lg"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-2">
                {navigation.map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <Link
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 rounded-lg text-base font-medium min-h-[44px] flex items-center transition-colors ${
                        isActive(item.href) ? 'bg-secondary text-primary' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                >
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-base font-medium min-h-[44px] flex items-center text-gray-400 hover:bg-gray-50"
                  >
                    Main Website
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer — matches main site */}
      <footer className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="mb-4 bg-white rounded-lg px-3 py-2 w-fit">
                <img
                  src="/logo.jpeg"
                  alt="Cornerstone Accounting & Business Management"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                Your secure client portal for tracking tax returns, uploading documents, and staying informed.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-gray-300">Portal</h3>
              <ul className="space-y-3">
                {[
                  { to: '/portal', label: 'Dashboard' },
                  { to: '/portal/returns', label: 'My Returns' },
                  { to: '/portal/documents', label: 'Documents' },
                ].map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="group text-gray-400 hover:text-white text-sm transition-colors duration-200 inline-flex items-center gap-2"
                    >
                      <span className="w-0 group-hover:w-4 h-px bg-primary transition-all duration-300" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-gray-300">Contact Us</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 flex-shrink-0 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href="tel:671-828-8591" className="hover:text-white transition-colors">(671) 828-8591</a>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 flex-shrink-0 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:dmshimizucpa@gmail.com" className="hover:text-white transition-colors">dmshimizucpa@gmail.com</a>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>130 Aspinall Ave, Suite 202<br />Hagatna, Guam</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500">
            <p>&copy; {currentYear} Cornerstone Accounting & Business Services. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
