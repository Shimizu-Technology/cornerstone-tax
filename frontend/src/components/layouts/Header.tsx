import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/clerk-react'
import { useAuthContext } from '../../contexts/AuthContext'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  { name: 'Services', href: '/services' },
  { name: 'Contact', href: '/contact' },
]

function AuthSection({ mobile = false }: { mobile?: boolean }) {
  const { isClerkEnabled } = useAuthContext()
  if (!isClerkEnabled) return null

  if (mobile) {
    return (
      <>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="mt-2 px-4 py-3 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 min-h-[44px] flex items-center">
              Staff Login
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link
            to="/admin"
            className="mt-2 px-4 py-3 rounded-lg text-base font-medium text-primary bg-secondary min-h-[44px] flex items-center"
          >
            Dashboard
          </Link>
        </SignedIn>
      </>
    )
  }

  return (
    <div className="flex items-center gap-4 h-full">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="h-full inline-flex items-center text-sm font-medium text-gray-600 hover:text-primary transition-colors">
            Staff Login
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Link
          to="/admin"
          className="h-full inline-flex items-center text-sm font-medium text-gray-600 hover:text-primary transition-colors"
        >
          Dashboard
        </Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: "w-9 h-9" } }}
        />
      </SignedIn>
    </div>
  )
}

function MobileUserButton() {
  const { isClerkEnabled } = useAuthContext()
  if (!isClerkEnabled) return null

  return (
    <SignedIn>
      <UserButton
        afterSignOutUrl="/"
        appearance={{ elements: { avatarBox: "w-9 h-9" } }}
      />
    </SignedIn>
  )
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)

  const isActive = (path: string) => location.pathname === path

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
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-lg shadow-sm border-b border-neutral-warm/30'
          : 'bg-white'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center flex-shrink-0">
          <div className="h-14 sm:h-16 overflow-hidden flex items-center">
            <img
              src="/logo.jpeg"
              alt="Cornerstone Accounting & Business Management"
              className="h-28 sm:h-32 w-auto max-w-none object-contain"
            />
          </div>
        </Link>

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
            to="/intake"
            className="bg-primary text-white h-10 px-5 rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 hover:shadow-md hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center justify-center"
          >
            Client Intake
          </Link>
          <AuthSection />
        </div>

        <div className="flex items-center md:hidden gap-2">
          <MobileUserButton />
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
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Link
                  to="/intake"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 bg-primary text-white px-4 py-3 rounded-lg text-base font-medium text-center min-h-[48px] flex items-center justify-center"
                >
                  Client Intake Form
                </Link>
              </motion.div>
              <AuthSection mobile />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
