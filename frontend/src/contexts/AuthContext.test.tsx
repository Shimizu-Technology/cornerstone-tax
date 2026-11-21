import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clerk = vi.hoisted(() => ({ user: { id: 'user_a' } as { id: string } | null, signedIn: true }))
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'token', isLoaded: true, isSignedIn: clerk.signedIn }),
  useUser: () => ({ user: clerk.user }),
}))
vi.mock('../lib/api', () => ({
  setAuthTokenGetter: vi.fn(),
  api: { getCurrentUser: vi.fn().mockResolvedValue({ data: { user: { role: 'employee' } } }) },
}))

import { AuthProvider } from './AuthContext'

describe('AuthProvider', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    clerk.user = { id: 'user_a' }
    clerk.signedIn = true
  })

  it('purges unsaved time drafts when the user signs out', () => {
    const { rerender } = render(<AuthProvider isClerkEnabled><p>app</p></AuthProvider>)
    window.sessionStorage.setItem('cst.logMyDay.drafts.7', JSON.stringify({ '7:2026-11-16:day-log': { lines: [{ description: 'Private' }] } }))
    window.sessionStorage.setItem('cst.logMyDay.owner', '7')
    window.sessionStorage.setItem('unrelated', 'kept')

    clerk.user = null
    clerk.signedIn = false
    rerender(<AuthProvider isClerkEnabled><p>app</p></AuthProvider>)

    expect(window.sessionStorage.getItem('cst.logMyDay.drafts.7')).toBeNull()
    expect(window.sessionStorage.getItem('cst.logMyDay.owner')).toBeNull()
    expect(window.sessionStorage.getItem('unrelated')).toBe('kept')
  })

  it('purges them when a different person signs in', () => {
    const { rerender } = render(<AuthProvider isClerkEnabled><p>app</p></AuthProvider>)
    window.sessionStorage.setItem('cst.logMyDay.drafts.7', '{}')

    clerk.user = { id: 'user_b' }
    rerender(<AuthProvider isClerkEnabled><p>app</p></AuthProvider>)

    expect(window.sessionStorage.getItem('cst.logMyDay.drafts.7')).toBeNull()
  })
})
