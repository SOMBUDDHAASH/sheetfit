import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 860,
  isMaximized: false
}

function getStateFilePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const filePath = getStateFilePath()
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      // Verify the saved position is still within visible display bounds
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        const matchingDisplay = screen.getAllDisplays().find((display) => {
          const { x, y, width, height } = display.bounds
          return (
            data.x >= x &&
            data.x < x + width &&
            data.y >= y &&
            data.y < y + height
          )
        })
        if (!matchingDisplay) {
          // If display was disconnected, reset coordinates
          delete data.x
          delete data.y
        }
      }
      return { ...DEFAULT_STATE, ...data }
    }
  } catch (err) {
    console.error('Failed to load window state:', err)
  }
  return DEFAULT_STATE
}

export function saveWindowState(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return
    const isMaximized = win.isMaximized()
    let state: WindowState

    if (isMaximized) {
      state = {
        ...DEFAULT_STATE,
        isMaximized: true
      }
    } else {
      const bounds = win.getBounds()
      state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: false
      }
    }

    writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save window state:', err)
  }
}
