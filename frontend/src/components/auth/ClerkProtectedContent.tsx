import { useEffect, useState, useRef } from 'react'
import { useAuth, useUser, RedirectToSignIn } from '@clerk/clerk-react'
import { api, setAuthTokenGetter } from '../../lib/api'

// Define user type locally to avoid import issues
interface UserProfile {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  role: 'admin' | 'employee' | 'client'
  is_admin: boolean
  is_staff: boolean
  created_at: string
}

interface ClerkProtectedContentProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'employee' | 'staff'
}

type AuthStatus = 'loading' | 'checking' | 'authorized' | 'unauthorized' | 'access_denied'

// This component is only rendered when ClerkProvider is present (isClerkEnabled is true)
export default function ClerkProtectedContent({ children, requiredRole }: ClerkProtectedContentProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const authSetupRef = useRef(false)

  // Set up the auth token getter when the component mounts
  useEffect(() => {
    if (authSetupRef.current) return

    setAuthTokenGetter(async () => {
      try {
        return await getToken()
      } catch (error) {
        console.error('Failed to get auth token:', error)
        return null
      }
    })
    authSetupRef.current = true
  }, [getToken])

  // Verify user with backend once Clerk confirms they're signed in
  useEffect(() => {
    const verifyUser = async () => {
      if (!isLoaded) return
      
      if (!isSignedIn) {
        setAuthStatus('unauthorized')
        return
      }

      setAuthStatus('checking')

      // Wait a moment for token getter to be set up
      await new Promise(resolve => setTimeout(resolve, 100))

      const maxRetries = 3
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Get email from Clerk user object
          const email = clerkUser?.primaryEmailAddress?.emailAddress
          const response = await api.getCurrentUser(email)
          
          if (response.data) {
            const user = response.data.user
            console.log('User verified:', user.email, 'Role:', user.role)
            setCurrentUser(user)

            // Check role if required
            if (requiredRole) {
              const hasAccess = 
                requiredRole === 'staff' ? user.is_staff :
                requiredRole === 'admin' ? user.is_admin :
                user.role === requiredRole

              if (!hasAccess) {
                console.log(`Access denied: requires ${requiredRole}, user is ${user.role}`)
                setAuthStatus('access_denied')
                return
              }
            }

            setAuthStatus('authorized')
            return
          } else if (response.error) {
            console.error('Auth verification failed:', response.error)
            // If it's an auth error, don't retry
            if (response.error.includes('authorization') || response.error.includes('token')) {
              setAuthStatus('unauthorized')
              return
            }
          }
        } catch (error) {
          console.error(`Auth verification attempt ${attempt + 1} failed:`, error)
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // All retries failed
      setAuthStatus('unauthorized')
    }

    verifyUser()
  }, [isLoaded, isSignedIn, requiredRole, clerkUser])

  // Loading state - Clerk not ready
  if (!isLoaded || authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // Checking state - verifying with backend
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  // Not signed in - redirect to sign in
  if (authStatus === 'unauthorized' || !isSignedIn) {
    return <RedirectToSignIn signInForceRedirectUrl={window.location.href} />
  }

  // Access denied - user doesn't have required role
  if (authStatus === 'access_denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this area. 
            {requiredRole && ` This page requires ${requiredRole} access.`}
          </p>
          <p className="text-sm text-gray-500">
            Signed in as: {currentUser?.email}
          </p>
          <a
            href="/"
            className="mt-6 inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  // Authorized - render children
  return <>{children}</>
}
