import React, { useState, useRef } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { buildPdf } from '../export/buildPdf'
import { buildPdfWithTargetSize } from '../export/compress'
import { X, Download, FileCheck, Loader2 } from 'lucide-react'

export const ExportDialog: React.FC = () => {
  const isExportDialogOpen = useUi((state) => state.isExportDialogOpen)
  const setExportDialogOpen = useUi((state) => state.setExportDialogOpen)
  const addToast = useUi((state) => state.addToast)

  const doc = useProject((state) => state.doc)

  const [quality, setQuality] = useState<'max' | 'high' | 'balanced' | 'small'>('high')
  const [targetSizeMb, setTargetSizeMb] = useState<string>('')
  const [showScaleBar, setShowScaleBar] = useState(doc.settings.showScaleBar)
  const [showCutGuides, setShowCutGuides] = useState(doc.settings.showCutGuides)
  const [pageRange, setPageRange] = useState<'all' | 'current'>('all')

  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const isCancelledRef = useRef(false)

  if (!isExportDialogOpen) return null

  const getQualityValue = () => {
    switch (quality) {
      case 'max':
        return 1.0
      case 'high':
        return 0.92
      case 'balanced':
        return 0.8
      case 'small':
        return 0.6
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setProgress(5)
    setStatusText('Preparing document...')
    isCancelledRef.current = false

    try {
      const today = new Date().toISOString().slice(0, 10)
      const defaultName = `SheetFit-${today}.pdf`

      let pdfBytes: Uint8Array

      if (targetSizeMb && parseFloat(targetSizeMb) > 0) {
        pdfBytes = await buildPdfWithTargetSize(doc, {
          targetSizeMb: parseFloat(targetSizeMb),
          onProgress: (p, s) => {
            setProgress(p)
            setStatusText(s)
          },
          isCancelled: () => isCancelledRef.current
        })
      } else {
        pdfBytes = await buildPdf(doc, {
          jpegQuality: getQualityValue(),
          showScaleBar,
          showCutGuides,
          pageRange,
          onProgress: (p, s) => {
            setProgress(p)
            setStatusText(s)
          },
          isCancelled: () => isCancelledRef.current
        })
      }

      if (window.api) {
        const savePath = await window.api.saveFileDialog({
          title: 'Save PDF Document',
          defaultPath: defaultName,
          filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
        })

        if (savePath) {
          await window.api.writeFile(savePath, pdfBytes)
          addToast({
            title: 'PDF exported successfully',
            description: savePath,
            type: 'success',
            actionLabel: 'Reveal in Explorer',
            onAction: () => {
              window.api?.revealInFolder(savePath)
            }
          })
          setExportDialogOpen(false)
        }
      } else {
        // Fallback for browser testing
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        a.click()
        URL.revokeObjectURL(url)
        addToast({ title: 'PDF exported', type: 'success' })
        setExportDialogOpen(false)
      }
    } catch (err: any) {
      if (err.message !== 'Export cancelled by user' && err.message !== 'Export cancelled') {
        addToast({
          title: 'Export Failed',
          description: err.message,
          type: 'error'
        })
      }
    } finally {
      setIsExporting(false)
      setProgress(0)
      setStatusText('')
    }
  }

  const handleCancel = () => {
    isCancelledRef.current = true
    setIsExporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Export PDF Document
            </h2>
          </div>
          {!isExporting && (
            <button
              onClick={() => setExportDialogOpen(false)}
              className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form Options */}
        <div className="space-y-4 text-xs">
          {/* Quality Presets */}
          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
              Image Quality
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'max', label: 'Max (100%)' },
                  { id: 'high', label: 'High (92%)' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'small', label: 'Small' }
                ] as const
              ).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuality(q.id)}
                  className={`py-1.5 px-2 rounded-lg font-medium border transition-colors ${
                    quality === q.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target File Size */}
          <div>
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              Target File Size (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="e.g. 5"
                min="0.5"
                step="0.5"
                value={targetSizeMb}
                onChange={(e) => setTargetSizeMb(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
              />
              <span className="text-neutral-500">MB (Auto-adjusts compression for portal uploads)</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showScaleBar}
                onChange={(e) => setShowScaleBar(e.target.checked)}
                className="rounded accent-blue-600"
              />
              <span className="text-neutral-800 dark:text-neutral-200">
                Include 100 mm Verification Scale Bar
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCutGuides}
                onChange={(e) => setShowCutGuides(e.target.checked)}
                className="rounded accent-blue-600"
              />
              <span className="text-neutral-800 dark:text-neutral-200">
                Include Dotted Cut Guides Between Cells
              </span>
            </label>
          </div>

          {/* Page Range */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">Pages:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="pageRange"
                checked={pageRange === 'all'}
                onChange={() => setPageRange('all')}
                className="accent-blue-600"
              />
              <span>All ({doc.pages.length})</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="pageRange"
                checked={pageRange === 'current'}
                onChange={() => setPageRange('current')}
                className="accent-blue-600"
              />
              <span>Current Page</span>
            </label>
          </div>
        </div>

        {/* Progress Bar while exporting */}
        {isExporting && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {statusText || 'Rendering...'}
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          {isExporting ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 text-xs font-medium"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                onClick={() => setExportDialogOpen(false)}
                className="px-4 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <FileCheck className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
