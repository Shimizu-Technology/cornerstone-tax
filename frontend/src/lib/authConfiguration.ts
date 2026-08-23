export function isClerkConfigured(publishableKey: string | undefined): boolean {
  const normalized = publishableKey?.trim()
  return Boolean(normalized && /^pk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(normalized))
}

export function isProductionAuthUnavailable({
  isClerkEnabled,
  isProduction,
}: {
  isClerkEnabled: boolean
  isProduction: boolean
}): boolean {
  return isProduction && !isClerkEnabled
}
