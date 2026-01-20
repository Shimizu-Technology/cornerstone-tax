import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isClerkEnabled = Boolean(PUBLISHABLE_KEY && PUBLISHABLE_KEY !== 'YOUR_PUBLISHABLE_KEY')

// Log warning if Clerk is not configured
if (!isClerkEnabled) {
  console.warn('⚠️ Clerk not configured - running without authentication. Add VITE_CLERK_PUBLISHABLE_KEY to .env.local')
}

function Root() {
  // If Clerk is enabled, wrap with ClerkProvider
  if (isClerkEnabled) {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <AuthProvider isClerkEnabled={true}>
          <App />
        </AuthProvider>
      </ClerkProvider>
    )
  }

  // Otherwise, just render the app without Clerk
  return (
    <AuthProvider isClerkEnabled={false}>
      <App />
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
