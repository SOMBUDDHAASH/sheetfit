import { Menu, MenuItemConstructorOptions, BrowserWindow, app } from 'electron'

export function setupAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'quit' as const }]
          }
        ]
      : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'Add &Images...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:add-images')
        },
        { type: 'separator' },
        {
          label: '&Save Project...',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save-project')
        },
        {
          label: '&Open Project...',
          click: () => mainWindow.webContents.send('menu:open-project')
        },
        { type: 'separator' },
        {
          label: '&Export PDF...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu:export-pdf')
        },
        {
          label: '&Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send('menu:print')
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        {
          label: '&Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:undo')
        },
        {
          label: '&Redo',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu:redo')
        },
        { type: 'separator' },
        {
          label: 'Delete Selected',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu:delete')
        },
        {
          label: 'Rotate 90° CW',
          accelerator: 'R',
          click: () => mainWindow.webContents.send('menu:rotate-cw')
        }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: '?',
          click: () => mainWindow.webContents.send('menu:shortcuts')
        },
        {
          label: 'Print Calibration Page',
          click: () => mainWindow.webContents.send('menu:calibration-page')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
