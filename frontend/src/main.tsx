/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { isClerkConfigured } from './lib/authConfiguration'
import { PostHogProvider } from './providers/PostHogProvider'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isClerkEnabled = isClerkConfigured(PUBLISHABLE_KEY)

if (!isClerkEnabled && import.meta.env.PROD) {
  console.error(
    'VITE_CLERK_PUBLISHABLE_KEY is not set. Staff and client routes are unavailable until Clerk is configured.',
  )
}

if (!isClerkEnabled && import.meta.env.DEV) {
  console.warn('Clerk not configured - development auth bypass is active. Add VITE_CLERK_PUBLISHABLE_KEY to .env.local')
}

function Root() {
  // If Clerk is enabled, wrap with ClerkProvider
  if (isClerkEnabled) {
    return (
      <PostHogProvider>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <AuthProvider isClerkEnabled={true}>
            <App />
          </AuthProvider>
        </ClerkProvider>
      </PostHogProvider>
    )
  }

  // Otherwise, just render the app without Clerk
  return (
    <PostHogProvider>
      <AuthProvider isClerkEnabled={false}>
        <App />
      </AuthProvider>
    </PostHogProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
