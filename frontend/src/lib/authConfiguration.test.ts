import { describe, expect, it } from 'vitest'

import { isClerkConfigured, isProductionAuthUnavailable } from './authConfiguration'

describe('authentication deployment configuration', () => {
  it.each([
    undefined,
    '',
    '   ',
    'YOUR_PUBLISHABLE_KEY',
    'pk_live_...',
    'pk_test_xxxxx',
    'pk_test_abc123',
  ])(
    'treats %p as an unconfigured Clerk key',
    (publishableKey) => {
      expect(isClerkConfigured(publishableKey)).toBe(false)
    },
  )

  it('accepts a configured Clerk publishable key', () => {
    expect(isClerkConfigured('pk_live_Y29ybmVyc3RvbmUuZXhhbXBsZSQ')).toBe(true)
  })

  it('fails closed when production is missing Clerk', () => {
    expect(isProductionAuthUnavailable({ isClerkEnabled: false, isProduction: true })).toBe(true)
  })

  it('retains the local development bypass only outside production', () => {
    expect(isProductionAuthUnavailable({ isClerkEnabled: false, isProduction: false })).toBe(false)
  })

  it('does not block a production deployment with Clerk configured', () => {
    expect(isProductionAuthUnavailable({ isClerkEnabled: true, isProduction: true })).toBe(false)
  })
})
