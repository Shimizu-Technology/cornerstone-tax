import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

// Auth section component - only renders Clerk components when enabled
function AuthSection({ mobile = false }: { mobile?: boolean }) {
  const { isClerkEnabled } = useAuthContext()

  if (!isClerkEnabled) {
    return null
  }

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
          appearance={{
            elements: {
              avatarBox: "w-9 h-9"
            }
          }}
        />
      </SignedIn>
    </div>
  )
}

function MobileUserButton() {
  const { isClerkEnabled } = useAuthContext()

  if (!isClerkEnabled) {
    return null
  }

  return (
    <SignedIn>
      <UserButton 
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-9 h-9"
          }
        }}
      />
    </SignedIn>
  )
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)

  const isActive = (path: string) => location.pathname === path

  // Close mobile menu when clicking outside
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <header ref={headerRef} className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo - Using overflow hidden to crop white space from image */}
        <Link to="/" className="flex items-center flex-shrink-0">
          <div className="h-14 sm:h-16 overflow-hidden flex items-center">
            <img 
              src="/logo.jpeg" 
              alt="Cornerstone Accounting & Business Management" 
              className="h-28 sm:h-32 w-auto max-w-none object-contain"
            />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 h-full">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`h-full inline-flex items-center text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-primary'
                  : 'text-gray-600 hover:text-primary'
              }`}
            >
              {item.name}
            </Link>
          ))}
          <Link
            to="/intake"
            className="bg-primary text-white h-10 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors inline-flex items-center justify-center"
          >
            Client Intake
          </Link>

          <AuthSection />
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center md:hidden gap-2">
          <MobileUserButton />
          <button
            type="button"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden py-4 border-t bg-white">
          <div className="max-w-7xl mx-auto px-4 flex flex-col gap-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-lg text-base font-medium min-h-[44px] flex items-center ${
                  isActive(item.href)
                    ? 'bg-secondary text-primary'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              to="/intake"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 bg-primary text-white px-4 py-3 rounded-lg text-base font-medium text-center min-h-[48px] flex items-center justify-center"
            >
              Client Intake Form
            </Link>

            <AuthSection mobile />
          </div>
        </div>
      )}
    </header>
  )
}
