import React, { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { Canvas } from './components/Canvas'
import { Inspector } from './components/Inspector'
import { CropModal } from './components/CropModal'
import { ExportDialog } from './components/ExportDialog'
import { PrintTipDialog } from './components/PrintTipDialog'
import { ShortcutsOverlay } from './components/ShortcutsOverlay'
import { DropOverlay } from './components/DropOverlay'
import { Toasts } from './components/Toasts'
import { PrintContainer } from './export/printHtml'
import { useProject } from './store/useProject'
import { useUi } from './store/useUi'
import { importFromFiles, importFromFilePaths } from './io/importImages'
import { startAutosave, stopAutosave, checkAutosaveRecovery } from './io/autosave'
import { saveProjectToFile, openProjectFromFile } from './io/projectFile'
import { generateCalibrationPdf } from './export/calibrationPage'
import { buildPdf } from './export/buildPdf'

export const App: React.FC = () => {
  const doc = useProject((state) => state.doc)
  const addImages = useProject((state) => state.addImages)
  const removeImage = useProject((state) => state.removeImage)
  const updateImageEdit = useProject((state) => state.updateImageEdit)
  const loadDoc = useProject((state) => state.loadDoc)

  const isDraggingFiles = useUi((state) => state.isDraggingFiles)
  const setIsDraggingFiles = useUi((state) => state.setIsDraggingFiles)
  const selectedImageId = useUi((state) => state.selectedImageId)
  const setExportDialogOpen = useUi((state) => state.setExportDialogOpen)
  const setPrintTipDialogOpen = useUi((state) => state.setPrintTipDialogOpen)
  const setShortcutsOpen = useUi((state) => state.setShortcutsOpen)
  const isShortcutsOpen = useUi((state) => state.isShortcutsOpen)
  const addToast = useUi((state) => state.addToast)

  // 1. Initialize Autosave & Recovery
  useEffect(() => {
    startAutosave(() => useProject.getState().doc)

    // Check recovery on launch
    checkAutosaveRecovery().then((recoveredDoc) => {
      if (recoveredDoc && recoveredDoc.images.length > 0) {
        addToast({
          title: 'Unsaved session found',
          description: `Recover ${recoveredDoc.images.length} images from last session?`,
          type: 'info',
          actionLabel: 'Recover Session',
          duration: 10000,
          onAction: () => {
            loadDoc(recoveredDoc)
            addToast({ title: 'Session restored', type: 'success' })
          }
        })
      }
    })

    return () => stopAutosave()
  }, [])

  // 2. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          useProject.temporal.getState().redo()
        } else {
          useProject.temporal.getState().undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useProject.temporal.getState().redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        window.api?.openImagesDialog().then((paths) => {
          if (paths && paths.length > 0) {
            importFromFilePaths(paths).then(addImages)
          }
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveProjectToFile(useProject.getState().doc).then((path) => {
          if (path) addToast({ title: 'Project saved', description: path, type: 'success' })
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setExportDialogOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        const hasSeenTip = localStorage.getItem('sheetfit:print_tip_seen')
        if (!hasSeenTip) {
          setPrintTipDialogOpen(true)
        } else {
          executePrint()
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedImageId) {
          e.preventDefault()
          removeImage(selectedImageId)
        }
      } else if (e.key.toLowerCase() === 'r') {
        if (selectedImageId) {
          e.preventDefault()
          const img = doc.images.find((i) => i.id === selectedImageId)
          if (img) {
            const nextRot = ((img.edit.rotation + 90) % 360) as 0 | 90 | 180 | 270
            updateImageEdit(selectedImageId, { rotation: nextRot })
          }
        }
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShortcutsOpen(!isShortcutsOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImageId, doc.images, isShortcutsOpen])

  // 3. Electron Preload Menu & File Listeners
  useEffect(() => {
    if (!window.api) return

    const unsubImport = window.api.onImportFiles((filePaths) => {
      importFromFilePaths(filePaths).then((items) => {
        if (items.length > 0) addImages(items)
      })
    })

    const unsubAdd = window.api.onMenuAction('menu:add-images', () => {
      window.api?.openImagesDialog().then((paths) => {
        if (paths && paths.length > 0) importFromFilePaths(paths).then(addImages)
      })
    })

    const unsubSave = window.api.onMenuAction('menu:save-project', () => {
      saveProjectToFile(useProject.getState().doc)
    })

    const unsubOpen = window.api.onMenuAction('menu:open-project', () => {
      openProjectFromFile().then((d) => {
        if (d) {
          loadDoc(d)
          addToast({ title: 'Project loaded', type: 'success' })
        }
      })
    })

    const unsubExport = window.api.onMenuAction('menu:export-pdf', () => {
      setExportDialogOpen(true)
    })

    const unsubPrint = window.api.onMenuAction('menu:print', () => {
      executePrint()
    })

    const unsubCal = window.api.onMenuAction('menu:calibration-page', async () => {
      const bytes = await generateCalibrationPdf()
      const tempPath = await window.api!.getTempPdfPath()
      await window.api!.writeFile(tempPath, bytes)
      await window.api!.openPath(tempPath)
    })

    const unsubShortcuts = window.api.onMenuAction('menu:shortcuts', () => {
      setShortcutsOpen(true)
    })

    const unsubUndo = window.api.onMenuAction('menu:undo', () => {
      useProject.temporal.getState().undo()
    })

    const unsubRedo = window.api.onMenuAction('menu:redo', () => {
      useProject.temporal.getState().redo()
    })

    return () => {
      unsubImport()
      unsubAdd()
      unsubSave()
      unsubOpen()
      unsubExport()
      unsubPrint()
      unsubCal()
      unsubShortcuts()
      unsubUndo()
      unsubRedo()
    }
  }, [])

  const executePrint = async () => {
    try {
      if (window.api) {
        const pdfBytes = await buildPdf(useProject.getState().doc)
        const tempPath = await window.api.getTempPdfPath()
        await window.api.writeFile(tempPath, pdfBytes)
        await window.api.openPath(tempPath)
        addToast({ title: 'Opened in PDF Viewer', description: 'Print at 100% / Actual Size', type: 'info' })
      } else {
        window.print()
      }
    } catch (err: any) {
      addToast({ title: 'Print error', description: err.message, type: 'error' })
    }
  }

  // 4. Drag and Drop onto Window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFiles(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDraggingFiles(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFiles(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    try {
      const items = await importFromFiles(files, {
        onRejected: (rejected) => {
          addToast({
            title: 'Unsupported file format',
            description: rejected.join(', '),
            type: 'warning'
          })
        },
        onError: (name, err) => {
          addToast({
            title: `Failed to load ${name}`,
            description: err.message,
            type: 'error'
          })
        }
      })
      if (items.length > 0) {
        addImages(items)
      }
    } catch (err: any) {
      addToast({ title: 'Import error', description: err.message, type: 'error' })
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
    >
      <TopBar />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <Canvas />
        <Inspector />
      </div>

      {/* Modals & Dialogs */}
      <CropModal />
      <ExportDialog />
      <PrintTipDialog onConfirm={executePrint} />
      <ShortcutsOverlay />
      <DropOverlay isDragging={isDraggingFiles} />
      <Toasts />

      {/* Print-only Container for Quick Print */}
      <PrintContainer doc={doc} />
    </div>
  )
}
