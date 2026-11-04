import React, { useRef } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { QUICK_TEMPLATES } from '../engine/templates'
import { EXACT_PRESETS } from '../engine/exactSheet'
import { generateCalibrationPdf } from '../export/calibrationPage'
import { buildPdf } from '../export/buildPdf'
import { importFromFiles, importFromFilePaths } from '../io/importImages'
import {
  ImagePlus,
  Undo2,
  Redo2,
  Download,
  Printer,
  Sun,
  Moon,
  Laptop,
  HelpCircle,
  SlidersHorizontal,
  Compass
} from 'lucide-react'

export const TopBar: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const doc = useProject((state) => state.doc)
  const addImages = useProject((state) => state.addImages)
  const setGlobalTemplate = useProject((state) => state.setGlobalTemplate)
  const updateSettings = useProject((state) => state.updateSettings)

  const undo = () => useProject.temporal.getState().undo()
  const redo = () => useProject.temporal.getState().redo()

  const theme = useUi((state) => state.theme)
  const setTheme = useUi((state) => state.setTheme)
  const zoomPercent = useUi((state) => state.zoomPercent)
  const setZoomPercent = useUi((state) => state.setZoomPercent)
  const setExportDialogOpen = useUi((state) => state.setExportDialogOpen)
  const setPrintTipDialogOpen = useUi((state) => state.setPrintTipDialogOpen)
  const setShortcutsOpen = useUi((state) => state.setShortcutsOpen)
  const addToast = useUi((state) => state.addToast)

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
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
      if (items.length > 0) addImages(items)
    } catch (err: any) {
      addToast({ title: 'Import error', description: err.message, type: 'error' })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAddImagesClick = async () => {
    if (window.api) {
      try {
        const filePaths = await window.api.openImagesDialog()
        if (filePaths && filePaths.length > 0) {
          const items = await importFromFilePaths(filePaths)
          if (items.length > 0) addImages(items)
        }
      } catch (err: any) {
        addToast({ title: 'File dialog error', description: err.message, type: 'error' })
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handlePrintClick = () => {
    const hasSeenTip = localStorage.getItem('sheetfit:print_tip_seen')
    if (!hasSeenTip) {
      setPrintTipDialogOpen(true)
    } else {
      executePrint()
    }
  }

  const executePrint = async () => {
    try {
      if (window.api) {
        // Open in PDF Viewer (recommended accurate path)
        const pdfBytes = await buildPdf(doc)
        const tempPath = await window.api.getTempPdfPath()
        await window.api.writeFile(tempPath, pdfBytes)
        await window.api.openPath(tempPath)
        addToast({
          title: 'Opened in PDF Viewer',
          description: 'Print at 100% / Actual Size',
          type: 'info'
        })
      } else {
        window.print()
      }
    } catch (err: any) {
      addToast({ title: 'Print error', description: err.message, type: 'error' })
    }
  }

  const handleCalibrationPrint = async () => {
    try {
      const calBytes = await generateCalibrationPdf()
      if (window.api) {
        const tempPath = await window.api.getTempPdfPath()
        await window.api.writeFile(tempPath, calBytes)
        await window.api.openPath(tempPath)
        addToast({
          title: 'Opened Calibration Sheet',
          description: 'Measure the 100 mm bar with a ruler after printing',
          type: 'info'
        })
      }
    } catch (err: any) {
      addToast({ title: 'Calibration error', description: err.message, type: 'error' })
    }
  }

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 select-none z-30 text-xs">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Left: Brand & Add Images */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            SF
          </div>
          <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 tracking-tight">
            SheetFit
          </span>
        </div>

        <button
          onClick={handleAddImagesClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs transition-colors"
          title="Add Images (Ctrl+O)"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          <span>Add Images</span>
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          <button
            onClick={undo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle: Mode & Templates & Margin/Gutter */}
      <div className="flex items-center gap-4">
        {/* Mode Toggle: Flexible vs Exact */}
        <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => updateSettings({ mode: 'flexible' })}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              doc.settings.mode === 'flexible'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Flexible Grid
          </button>
          <button
            onClick={() => updateSettings({ mode: 'exact' })}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              doc.settings.mode === 'exact'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Exact-Size
          </button>
        </div>

        {/* Flexible: 1 / 2 / 4 / 6 quick templates */}
        {doc.settings.mode === 'flexible' ? (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {QUICK_TEMPLATES.map((qt) => (
              <button
                key={qt.key}
                onClick={() => {
                  setGlobalTemplate(qt.templateId)
                  addToast({ title: `Global layout set to ${qt.label} photos`, type: 'info' })
                }}
                className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition-colors ${
                  doc.settings.preset === qt.templateId
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
                title={`${qt.label} photos per page`}
              >
                {qt.label}
              </button>
            ))}
          </div>
        ) : (
          /* Exact Presets Dropdown */
          <select
            value={doc.settings.exactPreset || 'passport'}
            onChange={(e) => updateSettings({ exactPreset: e.target.value })}
            className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs"
          >
            {Object.values(EXACT_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Spacing Controls */}
        <div className="hidden lg:flex items-center gap-2 text-neutral-500 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <div className="flex items-center gap-1">
            <span>Margin:</span>
            <input
              type="number"
              min="0"
              max="50"
              value={doc.settings.marginMm}
              onChange={(e) => updateSettings({ marginMm: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-12 px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-center font-mono text-xs"
            />
            <span>mm</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span>Gutter:</span>
            <input
              type="number"
              min="0"
              max="30"
              value={doc.settings.gutterMm}
              onChange={(e) => updateSettings({ gutterMm: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-12 px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-center font-mono text-xs"
            />
            <span>mm</span>
          </div>
        </div>
      </div>

      {/* Right: Export, Print, Calibration, Zoom, Theme, Help */}
      <div className="flex items-center gap-2">
        {/* Scale & Guides Toggles */}
        <div className="hidden xl:flex items-center gap-1.5 text-neutral-500 mr-1">
          <label className="flex items-center gap-1 cursor-pointer" title="Show physical millimeter size badges on cells">
            <input
              type="checkbox"
              checked={doc.settings.showSizeBadges}
              onChange={(e) => updateSettings({ showSizeBadges: e.target.checked })}
              className="rounded accent-blue-600"
            />
            <span className="text-[11px]">Badges</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer ml-1" title="Show 100mm scale bar on page">
            <input
              type="checkbox"
              checked={doc.settings.showScaleBar}
              onChange={(e) => updateSettings({ showScaleBar: e.target.checked })}
              className="rounded accent-blue-600"
            />
            <span className="text-[11px]">Scale Bar</span>
          </label>
        </div>

        {/* Calibration Page */}
        <button
          onClick={handleCalibrationPrint}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          title="Print 1-Page Scale Calibration Sheet"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Print Button */}
        <button
          onClick={handlePrintClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-neutral-800 dark:text-neutral-200 transition-colors"
          title="Print / Open in PDF Viewer (Ctrl+P)"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print</span>
        </button>

        {/* Export PDF */}
        <button
          onClick={() => setExportDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs transition-colors"
          title="Export Exact A4 PDF (Ctrl+E)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export PDF</span>
        </button>

        {/* Zoom */}
        <div className="flex items-center gap-1 border-l border-neutral-200 dark:border-neutral-800 pl-2">
          <button
            onClick={() => setZoomPercent(zoomPercent - 10)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 font-bold"
          >
            -
          </button>
          <span className="font-mono text-[11px] w-9 text-center text-neutral-600 dark:text-neutral-400">
            {zoomPercent}%
          </span>
          <button
            onClick={() => setZoomPercent(zoomPercent + 10)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 font-bold"
          >
            +
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          title={`Theme: ${theme}`}
        >
          {theme === 'light' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : theme === 'dark' ? (
            <Moon className="w-4 h-4 text-blue-400" />
          ) : (
            <Laptop className="w-4 h-4" />
          )}
        </button>

        {/* Help Shortcuts */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          title="Shortcuts (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
