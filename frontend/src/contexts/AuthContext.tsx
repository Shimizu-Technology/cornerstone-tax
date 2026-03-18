import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [userRole, setUserRole] = useState<'admin' | 'employee' | 'client' | null>(null)
  const [roleFetched, setRoleFetched] = useState(false)

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

  const fetchRole = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !clerkUser) {
      setUserRole(null)
      setRoleFetched(true)
      return
    }

    if (roleFetched && userRole !== null) return

    try {
      const email = clerkUser.primaryEmailAddress?.emailAddress
        || clerkUser.emailAddresses?.[0]?.emailAddress
      const response = await api.getCurrentUser(email)
      if (response.data?.user) {
        setUserRole(response.data.user.role)
      }
    } catch {
      // Silently fail — the protected route will handle unauthorized
    } finally {
      setRoleFetched(true)
    }
  }, [isLoaded, isSignedIn, clerkUser, roleFetched, userRole])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchRole()
    } else if (isLoaded && !isSignedIn) {
      setUserRole(null)
      setRoleFetched(true)
    }
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
