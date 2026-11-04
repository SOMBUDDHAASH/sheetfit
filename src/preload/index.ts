import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface ElectronApi {
  openImagesDialog: () => Promise<string[]>
  readFile: (filePath: string) => Promise<Uint8Array>
  getPathForFile: (file: File) => string
  saveFileDialog: (options: {
    title?: string
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => Promise<string | null>
  writeFile: (filePath: string, data: Uint8Array | string) => Promise<boolean>
  openPath: (targetPath: string) => Promise<boolean>
  revealInFolder: (targetPath: string) => Promise<boolean>
  printHtml: () => Promise<boolean>
  loadSettings: () => Promise<unknown>
  saveSettings: (settings: unknown) => Promise<boolean>
  autosaveRead: () => Promise<unknown>
  autosaveWrite: (doc: unknown) => Promise<boolean>
  autosaveClear: () => Promise<boolean>
  getTempPdfPath: () => Promise<string>
  onMenuAction: (channel: string, callback: (...args: unknown[]) => void) => () => void
  onImportFiles: (callback: (filePaths: string[]) => void) => () => void
}

const api: ElectronApi = {
  openImagesDialog: () => ipcRenderer.invoke('dialog:openImages'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', filePath, data),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  revealInFolder: (targetPath) => ipcRenderer.invoke('shell:revealInFolder', targetPath),
  printHtml: () => ipcRenderer.invoke('print:html'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  autosaveWrite: (doc) => ipcRenderer.invoke('autosave:write', doc),
  autosaveClear: () => ipcRenderer.invoke('autosave:clear'),
  getTempPdfPath: () => ipcRenderer.invoke('path:getTempPdfPath'),
  onMenuAction: (channel, callback) => {
    const handler = (_event: unknown, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
  onImportFiles: (callback) => {
    const handler = (_event: unknown, filePaths: string[]) => callback(filePaths)
    ipcRenderer.on('app:import-files', handler)
    return () => {
      ipcRenderer.removeListener('app:import-files', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
