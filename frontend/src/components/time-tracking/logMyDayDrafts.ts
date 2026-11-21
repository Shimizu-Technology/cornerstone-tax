import type { WorkLineDraft } from './workLinesModel'

/** Unsaved Log my day lines for one day and session. */
export interface DayDraft {
  lines: WorkLineDraft[]
  /** The entry the draft was started on (null for a new day log). */
  baseEntryId?: number | null
  /** updated_at of that entry when the draft started (null for a new day log). */
  baseUpdatedAt: string | null
  /** That entry's exact change token (version) when the draft started. */
  baseVersion?: number | null
  /** Short label for the "Also unsaved" list. */
  label: string
}

const DRAFTS_STORAGE_PREFIX = 'cst.logMyDay.drafts.'
const OWNER_KEY = 'cst.logMyDay.owner'

/**
 * Removes every stored time draft (descriptions and client ids). Called on
 * sign-out and whenever a different person signs in, so nothing typed by one
 * user is left in the browser for the next.
 */
export function purgeTimeDrafts(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (key && (key.startsWith(DRAFTS_STORAGE_PREFIX) || key === OWNER_KEY)) keys.push(key)
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Storage unavailable: nothing was stored.
  }
}

/** Drafts belong to one person; a different signed-in user wipes them first. */
function claimDrafts(userId: number): void {
  try {
    const owner = window.sessionStorage.getItem(OWNER_KEY)
    if (owner !== String(userId)) {
      purgeTimeDrafts()
      window.sessionStorage.setItem(OWNER_KEY, String(userId))
    }
  } catch {
    // ignore
  }
}

export function readDrafts(userId: number | null): Record<string, DayDraft> {
  if (!userId) return {}
  claimDrafts(userId)
  try {
    const raw = window.sessionStorage.getItem(`${DRAFTS_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) as Record<string, DayDraft> : {}
  } catch {
    return {}
  }
}

export function writeDrafts(userId: number | null, drafts: Record<string, DayDraft>): void {
  if (!userId) return
  try {
    claimDrafts(userId)
    if (Object.keys(drafts).length) window.sessionStorage.setItem(`${DRAFTS_STORAGE_PREFIX}${userId}`, JSON.stringify(drafts))
    else window.sessionStorage.removeItem(`${DRAFTS_STORAGE_PREFIX}${userId}`)
  } catch {
    // Storage can be unavailable (private mode); drafts still live in state.
  }
}
