export function isClerkConfigured(publishableKey: string | undefined): boolean {
  const normalized = publishableKey?.trim()
  return Boolean(normalized && normalized !== 'YOUR_PUBLISHABLE_KEY')
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
