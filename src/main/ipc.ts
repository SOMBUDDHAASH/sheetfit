import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

export function setupIpc(mainWindow: BrowserWindow): void {
  // 1. Open Images Dialog
  ipcMain.handle('dialog:openImages', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Images for SheetFit',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Supported Images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  // 2. Read File as Uint8Array
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath)
      return new Uint8Array(buffer)
    } catch (err) {
      console.error(`Failed to read file: ${filePath}`, err)
      throw err
    }
  })

  // 3. Save File Dialog
  ipcMain.handle(
    'dialog:saveFile',
    async (
      _event,
      options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }
    ) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: options.title || 'Save Document',
        defaultPath: options.defaultPath,
        filters: options.filters || [{ name: 'PDF Document', extensions: ['pdf'] }]
      })
      return result.canceled ? null : result.filePath
    }
  )

  // 4. Write File from Uint8Array or String
  ipcMain.handle('file:write', async (_event, filePath: string, data: Uint8Array | string) => {
    try {
      if (typeof data === 'string') {
        await fs.writeFile(filePath, data, 'utf-8')
      } else {
        await fs.writeFile(filePath, Buffer.from(data))
      }
      return true
    } catch (err) {
      console.error(`Failed to write file: ${filePath}`, err)
      throw err
    }
  })

  // 5. Open Path in default OS viewer
  ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
    const errorMessage = await shell.openPath(targetPath)
    if (errorMessage) {
      throw new Error(errorMessage)
    }
    return true
  })

  // 6. Reveal in File Explorer
  ipcMain.handle('shell:revealInFolder', async (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath)
    return true
  })

  // 7. Quick Print HTML via WebContents
  ipcMain.handle('print:html', async () => {
    return new Promise((resolve, reject) => {
      mainWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: 'A4'
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason))
          } else {
            resolve(true)
          }
        }
      )
    })
  })

  // 8. Settings load and save
  const settingsPath = join(app.getPath('userData'), 'user-settings.json')
  ipcMain.handle('settings:load', async () => {
    try {
      const text = await fs.readFile(settingsPath, 'utf-8')
      return JSON.parse(text)
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:save', async (_event, data: unknown) => {
    try {
      await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('Failed to save settings:', err)
      return false
    }
  })

  // 9. Autosave read and write
  const autosavePath = join(app.getPath('userData'), 'autosave.json')
  ipcMain.handle('autosave:read', async () => {
    try {
      const text = await fs.readFile(autosavePath, 'utf-8')
      return JSON.parse(text)
    } catch {
      return null
    }
  })

  ipcMain.handle('autosave:write', async (_event, data: unknown) => {
    try {
      await fs.writeFile(autosavePath, JSON.stringify(data), 'utf-8')
      return true
    } catch (err) {
      console.error('Failed to autosave:', err)
      return false
    }
  })

  ipcMain.handle('autosave:clear', async () => {
    try {
      await fs.unlink(autosavePath)
      return true
    } catch {
      return false
    }
  })

  // 10. Get Temp Path for quick PDF preview
  ipcMain.handle('path:getTempPdfPath', async () => {
    const filename = `SheetFit-preview-${Date.now()}.pdf`
    return join(app.getPath('temp'), filename)
  })
}
