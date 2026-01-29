import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion'
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
  const { scrollY } = useScroll()

  const isActive = (path: string) => location.pathname === path

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20)
  })

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

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <motion.header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-neutral-warm/30'
          : 'bg-white/60 backdrop-blur-sm'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <nav className="max-w-6xl mx-auto px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center flex-shrink-0 group">
          <div className="h-14 sm:h-16 overflow-hidden flex items-center transition-transform duration-300 group-hover:scale-[1.02]">
            <img
              src="/logo.jpeg"
              alt="Cornerstone Accounting & Business Management"
              className="h-28 sm:h-32 w-auto max-w-none object-contain"
            />
          </div>
        </Link>

        {/* Desktop Navigation — pill style */}
        <div className="hidden md:flex items-center gap-1 bg-secondary/60 backdrop-blur-sm px-2 py-1.5 rounded-full border border-neutral-warm/40">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                isActive(item.href)
                  ? 'text-primary bg-white shadow-sm'
                  : 'text-gray-600 hover:text-primary hover:bg-white/60'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/intake"
            className="group px-5 py-2 bg-primary text-white rounded-full text-sm font-medium
              transition-all duration-200 hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20
              hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
          >
            Client Intake
            <svg
              className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <AuthSection />
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center md:hidden gap-2">
          <MobileUserButton />
          <button
            type="button"
            className="p-2 rounded-xl text-gray-600 hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="relative w-6 h-6">
              <span className={`absolute left-0 top-1 w-6 h-0.5 bg-current rounded-full transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 top-[11px]' : ''}`} />
              <span className={`absolute left-0 top-[11px] w-6 h-0.5 bg-current rounded-full transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`absolute left-0 top-[19px] w-6 h-0.5 bg-current rounded-full transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 top-[11px]' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden border-t border-neutral-warm/30 bg-white/95 backdrop-blur-xl"
          >
            <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
              {navigation.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl text-base font-medium min-h-[44px] flex items-center transition-colors ${
                      isActive(item.href)
                        ? 'bg-secondary text-primary'
                        : 'text-gray-600 hover:bg-secondary/50'
                    }`}
                  >
                    {item.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Link
                  to="/intake"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 bg-primary text-white px-4 py-3 rounded-xl text-base font-medium text-center min-h-[48px] flex items-center justify-center"
                >
                  Client Intake Form
                </Link>
              </motion.div>
              <AuthSection mobile />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
