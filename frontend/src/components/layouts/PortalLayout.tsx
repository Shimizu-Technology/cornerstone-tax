import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { SignedIn, UserButton } from '@clerk/clerk-react'
import { AnimatePresence } from 'framer-motion'
import { FadeUp } from '../ui/MotionComponents'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/portal', icon: HomeIcon },
  { name: 'My Returns', href: '/portal/returns', icon: DocumentIcon },
  { name: 'Documents', href: '/portal/documents', icon: FolderIcon },
]

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

export default function PortalLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/portal') return location.pathname === '/portal'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-secondary-dark sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/portal" className="flex items-center gap-3">
              <div className="text-primary-dark font-bold text-lg tracking-tight">CORNERSTONE</div>
              <span className="text-xs text-gray-400 hidden sm:inline">Client Portal</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-secondary hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-9 h-9',
                    }
                  }}
                />
              </SignedIn>
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-secondary"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-secondary-dark bg-white">
            <div className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-secondary'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <FadeUp key={location.pathname}>
            <Outlet />
          </FadeUp>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary-dark bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
            <p>Cornerstone Accounting & Business Services</p>
            <div className="flex items-center gap-4">
              <a href="tel:671-727-8242" className="hover:text-gray-600 transition-colors">671-727-8242</a>
              <Link to="/" className="hover:text-gray-600 transition-colors">Main Website</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
