import { app, BrowserWindow } from 'electron'

export function setupSingleInstance(
  onSecondInstance: (argv: string[], workingDirectory: string) => void
): boolean {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 0) {
      const mainWindow = allWindows[0]
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    onSecondInstance(commandLine, workingDirectory)
  })

  return true
}
