import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { setAuthTokenGetter, api } from '../lib/api'

interface AuthContextType {
  isClerkEnabled: boolean
  isSignedIn: boolean
  isLoading: boolean
  userRole: 'admin' | 'employee' | 'client' | null
  isClient: boolean
  isStaff: boolean
}

const AuthContext = createContext<AuthContextType>({ 
  isClerkEnabled: false,
  isSignedIn: false,
  isLoading: true,
  userRole: null,
  isClient: false,
  isStaff: false,
})

export function useAuthContext() {
  return useContext(AuthContext)
}

interface AuthProviderProps {
  children: ReactNode
  isClerkEnabled: boolean
}

const ROLE_CACHE_PREFIX = 'cst_role_'
type UserRole = 'admin' | 'employee' | 'client' | null

function getCachedRole(clerkId: string | undefined): UserRole {
  if (!clerkId) return null
  const cached = localStorage.getItem(`${ROLE_CACHE_PREFIX}${clerkId}`)
  if (cached === 'admin' || cached === 'employee' || cached === 'client') return cached
  return null
}

function setCachedRole(clerkId: string | undefined, role: UserRole) {
  if (!clerkId) return
  if (role) {
    localStorage.setItem(`${ROLE_CACHE_PREFIX}${clerkId}`, role)
  } else {
    localStorage.removeItem(`${ROLE_CACHE_PREFIX}${clerkId}`)
  }
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [userRole, setUserRole] = useState<'admin' | 'employee' | 'client' | null>(null)
  const [roleFetched, setRoleFetched] = useState(false)
  const fetchedRef = useRef(false)
  const fetchRoleRef = useRef<((retryCount?: number) => Promise<void>) | undefined>(undefined)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastClerkIdRef = useRef<string | null>(null)

  useEffect(() => {
    const currentClerkId = clerkUser?.id ?? null
    if (currentClerkId !== lastClerkIdRef.current) {
      lastClerkIdRef.current = currentClerkId
      fetchedRef.current = false
      clearTimeout(retryTimerRef.current)
    }
  }, [clerkUser?.id])

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        const token = await getToken()
        return token
      } catch (error) {
        console.error('Error getting auth token:', error)
        return null
      }
    })
  }, [getToken])

  const fetchRole = useCallback(async (retryCount = 0) => {
    if (!isLoaded || !isSignedIn || !clerkUser) {
      setUserRole(null)
      setRoleFetched(true)
      return
    }

    if (fetchedRef.current) return
    fetchedRef.current = true

    try {
      const email = clerkUser.primaryEmailAddress?.emailAddress
        || clerkUser.emailAddresses?.[0]?.emailAddress
      if (!email) {
        setUserRole(null)
        setRoleFetched(true)
        return
      }
      const response = await api.getCurrentUser(email)
      if (response.data?.user) {
        const role = response.data.user.role
        setUserRole(role)
        setCachedRole(clerkUser.id, role)
        setRoleFetched(true)
      } else {
        throw new Error('No user in response')
      }
    } catch {
      fetchedRef.current = false
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 1500
        retryTimerRef.current = setTimeout(() => fetchRoleRef.current?.(retryCount + 1), delay)
      } else {
        const fallback = getCachedRole(clerkUser.id)
        setUserRole(fallback)
        setRoleFetched(true)
      }
    }
  }, [isLoaded, isSignedIn, clerkUser])

  useLayoutEffect(() => {
    fetchRoleRef.current = fetchRole
  }, [fetchRole])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchRole()
    } else if (isLoaded && !isSignedIn) {
      clearTimeout(retryTimerRef.current)
      fetchedRef.current = false
      setCachedRole(lastClerkIdRef.current ?? undefined, null)
      setUserRole(null)
      setRoleFetched(true)
    }
    return () => clearTimeout(retryTimerRef.current)
  }, [isLoaded, isSignedIn, fetchRole])

  return (
    <AuthContext.Provider value={{ 
      isClerkEnabled: true, 
      isSignedIn: isSignedIn ?? false,
      isLoading: !isLoaded || (isSignedIn === true && !roleFetched),
      userRole,
      isClient: userRole === 'client',
      isStaff: userRole === 'admin' || userRole === 'employee',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function NoAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setAuthTokenGetter(async () => null)
  }, [])

  return (
    <AuthContext.Provider value={{ 
      isClerkEnabled: false, 
      isSignedIn: false,
      isLoading: false,
      userRole: null,
      isClient: false,
      isStaff: false,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children, isClerkEnabled }: AuthProviderProps) {
  if (isClerkEnabled) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>
  }

  return <NoAuthProvider>{children}</NoAuthProvider>
}
