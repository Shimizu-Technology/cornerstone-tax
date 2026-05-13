import { useState, useEffect, useRef, type ComponentType, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import { AnimatePresence } from 'framer-motion'
import { FadeUp } from '../ui/MotionComponents'
import {
  SignedIn,
  UserButton,
} from '@clerk/clerk-react'
import { api } from '../../lib/api'

interface NavItem {
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Clients', href: '/admin/clients', icon: UsersIcon },
  { name: 'Tax Returns', href: '/admin/returns', icon: DocumentIcon },
  { name: 'Daily Tasks', href: '/admin/tasks', icon: TaskListIcon },
  { name: 'Activity', href: '/admin/activity', icon: ActivityIcon },
  { name: 'Payroll Checklist', href: '/admin/operations', icon: ChecklistIcon },
  { name: 'Time Tracking', href: '/admin/time', icon: ClockIcon },
  { name: 'Schedule', href: '/admin/schedule', icon: CalendarIcon },
  { name: 'Users', href: '/admin/users', icon: TeamIcon, adminOnly: true },
  { name: 'Settings', href: '/admin/settings', icon: SettingsIcon, adminOnly: true },
]

const desktopSidebarStorageKey = 'cornerstone-admin-sidebar-collapsed'

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h11M9 12h11M9 19h11M5 5l1.5 1.5L8 5m-3 7l1.5 1.5L8 12m-3 7l1.5 1.5L8 19" />
    </svg>
  )
}

function TaskListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// Loading skeleton for nav items to prevent flash during permission check
function NavSkeleton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`flex items-center rounded-xl px-4 py-3 animate-pulse ${collapsed ? 'justify-center' : 'gap-3'}`}
        >
          <div className="w-5 h-5 bg-gray-200 rounded" />
          {!collapsed && <div className="h-4 bg-gray-200 rounded w-24" />}
        </div>
      ))}
    </>
  )
}

function FloatingTooltip({ anchorRef, label, visible }: { anchorRef: RefObject<HTMLElement | null>; label: string; visible: boolean }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!visible) return

    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 16,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, visible])

  if (!visible || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] flex -translate-y-1/2 items-center"
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      <span className="h-3 w-3 translate-x-[7px] rotate-45 rounded-[3px] bg-gray-950 shadow-lg" />
      <span className="whitespace-nowrap rounded-xl bg-gray-950 px-3.5 py-2 text-sm font-semibold text-white shadow-2xl">
        {label}
      </span>
    </div>,
    document.body
  )
}

function DesktopNavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <>
      <Link
        ref={anchorRef}
        key={item.name}
        to={item.href}
        aria-label={collapsed ? item.name : undefined}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className={`group relative grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center overflow-hidden rounded-xl text-sm font-medium transition-colors duration-200 ${
          active
            ? 'bg-primary text-white shadow-md'
            : 'text-gray-700 hover:bg-secondary-dark hover:text-primary'
        }`}
      >
        <span className="flex items-center justify-center">
          <item.icon className="h-5 w-5 shrink-0" />
        </span>
        <span
          aria-hidden={collapsed}
          className={`min-w-0 whitespace-nowrap transition-[opacity,transform] duration-200 ${
            collapsed ? '-translate-x-2 opacity-0' : 'translate-x-0 opacity-100'
          }`}
        >
          {item.name}
        </span>
      </Link>
      {collapsed && <FloatingTooltip anchorRef={anchorRef} label={item.name} visible={tooltipVisible} />}
    </>
  )
}

function DesktopBackLink({ collapsed }: { collapsed: boolean }) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <>
      <Link
        ref={anchorRef}
        to="/"
        aria-label={collapsed ? 'Back to Website' : undefined}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center overflow-hidden rounded-xl text-sm font-medium text-gray-500 transition-colors hover:bg-secondary-dark hover:text-primary"
      >
        <span className="flex items-center justify-center">
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </span>
        <span
          aria-hidden={collapsed}
          className={`min-w-0 whitespace-nowrap transition-[opacity,transform] duration-200 ${
            collapsed ? '-translate-x-2 opacity-0' : 'translate-x-0 opacity-100'
          }`}
        >
          Back to Website
        </span>
      </Link>
      {collapsed && <FloatingTooltip anchorRef={anchorRef} label="Back to Website" visible={tooltipVisible} />}
    </>
  )
}

function DesktopCollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className={
          'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-secondary-dark bg-white text-gray-600 shadow-sm transition-colors hover:bg-secondary hover:text-primary'
        }
        aria-label={label}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={collapsed ? 'M13 5l7 7-7 7M4 5h5v14H4z' : 'M11 19l-7-7 7-7M15 5h5v14h-5z'}
          />
        </svg>
      </button>
      <FloatingTooltip anchorRef={buttonRef} label={label} visible={tooltipVisible} />
    </>
  )
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(desktopSidebarStorageKey) === 'true'
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const location = useLocation()
  const { isClerkEnabled } = useAuthContext()

  // Fetch current user to check admin status
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.getCurrentUser()
        if (response.data?.user) {
          setIsAdmin(response.data.user.is_admin)
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error)
        // On API failure, show all nav items (route guards will enforce access)
        // This prevents hiding admin items due to transient network issues
        setIsAdmin(true)
      } finally {
        setIsLoadingUser(false)
      }
    }
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(desktopSidebarStorageKey, String(desktopCollapsed))
  }, [desktopCollapsed])

  // Filter navigation based on admin status (CST-26: enforce adminOnly flag)
  const filteredNavigation = navigation.filter(item => !item.adminOnly || isAdmin)

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-secondary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:shadow-lg focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>{sidebarOpen && (
        <div
          className="fixed inset-0 bg-primary/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}</AnimatePresence>

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-secondary-dark">
          <Link to="/" className="flex items-center">
            <img 
              src="/logo.jpeg" 
              alt="Cornerstone" 
              className="h-16 w-auto object-contain"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-primary p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Close sidebar"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {isLoadingUser ? (
            <NavSkeleton />
          ) : (
            filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'bg-primary text-white shadow-md'
                    : 'text-gray-700 hover:bg-secondary-dark'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))
          )}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-secondary-dark">
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-500 hover:text-primary text-sm font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Website
          </Link>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:flex lg:flex-col ${desktopCollapsed ? 'lg:w-24' : 'lg:w-72'}`}>
        <div className="flex grow flex-col overflow-y-auto overflow-x-hidden border-r border-secondary-dark bg-white pt-4 pb-4">
          <div className="flex h-20 shrink-0 items-center border-b border-secondary-dark px-3">
            <Link to="/" className="flex min-w-0 items-center justify-center">
              <img 
                src="/logo.jpeg" 
                alt="Cornerstone" 
                className={`w-auto object-contain transition-[height,max-width] duration-300 ${desktopCollapsed ? 'h-10 max-w-18' : 'h-16 max-w-48'}`}
              />
            </Link>
          </div>
          <div className="flex h-16 shrink-0 items-center px-6">
            <DesktopCollapseButton collapsed={desktopCollapsed} onToggle={() => setDesktopCollapsed((value) => !value)} />
          </div>
          <div className="relative h-4 px-3 pt-4">
            <p
              aria-hidden={!desktopCollapsed}
              className={`absolute left-3 top-4 w-18 text-center text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 transition-opacity duration-200 ${
                desktopCollapsed ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Nav
            </p>
            <p
              aria-hidden={desktopCollapsed}
              className={`absolute left-5 top-4 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 transition-[opacity,transform] duration-200 ${
                desktopCollapsed ? '-translate-x-2 opacity-0' : 'translate-x-0 opacity-100'
              }`}
            >
              Admin Navigation
            </p>
          </div>
          <nav className="mt-5 flex-1 space-y-1 overflow-visible px-3">
            {isLoadingUser ? (
              <NavSkeleton collapsed={desktopCollapsed} />
            ) : (
              filteredNavigation.map((item) => (
                <DesktopNavLink
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={desktopCollapsed}
                />
              ))
            )}
          </nav>
          <div className={`mx-3 border-t border-secondary-dark py-4 ${desktopCollapsed ? 'px-0' : 'px-1'}`}>
            <DesktopBackLink collapsed={desktopCollapsed} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex min-h-screen flex-col transition-[padding] duration-300 ${desktopCollapsed ? 'lg:pl-24' : 'lg:pl-72'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-secondary-dark">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              className="lg:hidden p-2 rounded-xl text-gray-600 hover:bg-secondary transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex-1 lg:flex-none" />
            <div className="flex items-center gap-4">
              {isClerkEnabled ? (
                <SignedIn>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-10 h-10 ring-2 ring-secondary-dark"
                      }
                    }}
                  />
                </SignedIn>
              ) : (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center ring-2 ring-secondary-dark">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8">
          <FadeUp><Outlet /></FadeUp>
        </main>
      </div>
    </div>
  )
}
