import { Doc } from '../types'

let autosaveTimer: ReturnType<typeof setInterval> | null = null

export function startAutosave(getDoc: () => Doc, intervalMs: number = 10000): void {
  if (autosaveTimer) clearInterval(autosaveTimer)

  autosaveTimer = setInterval(async () => {
    if (!window.api) return
    const doc = getDoc()
    // Only autosave if doc has images
    if (doc.images.length > 0) {
      await window.api.autosaveWrite(doc)
    }
  }, intervalMs)
}

export function stopAutosave(): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
}

export async function checkAutosaveRecovery(): Promise<Doc | null> {
  if (!window.api) return null
  try {
    const saved = (await window.api.autosaveRead()) as Doc | null
    if (saved && saved.images && saved.images.length > 0) {
      return saved
    }
  } catch {
    // Ignore error
  }
  return null
}
