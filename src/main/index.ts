import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { setupSingleInstance } from './singleInstance'
import { loadWindowState, saveWindowState } from './windowState'
import { setupIpc } from './ipc'
import { setupAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const windowState = loadWindowState()

  const preloadMjs = join(__dirname, '../preload/index.mjs')
  const preloadJs = join(__dirname, '../preload/index.js')
  const preloadPath = existsSync(preloadMjs) ? preloadMjs : preloadJs

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#0a0a0a',
    title: 'SheetFit',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  // Handle window state persistence
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow)
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Setup IPC and Menu
  setupIpc(mainWindow)
  setupAppMenu(mainWindow)

  // Load the remote URL for development or the local html file for production.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Single instance lock
const isPrimary = setupSingleInstance((argv) => {
  // Extract image paths passed from command line / "Open with"
  const fileArgs = argv.filter((arg) => {
    const ext = arg.toLowerCase().split('.').pop()
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext || '')
  })

  if (fileArgs.length > 0 && mainWindow) {
    mainWindow.webContents.send('app:import-files', fileArgs)
  }
})

if (isPrimary) {
  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
