import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { buildPdf } from '../export/buildPdf'
import { buildPdfWithTargetSize } from '../export/compress'
import { computeLayout } from '../engine/layoutTree'
import { computeDraw } from '../engine/drawRect'
import { getLeafAssignments } from '../engine/flow'
import { packExactSheet, EXACT_PRESETS } from '../engine/exactSheet'
import { A4_WIDTH_MM, A4_HEIGHT_MM, MM_PER_INCH } from '../engine/units'
import { ImageItem } from '../types'
import {
  X,
  Download,
  FileCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Printer,
  Sparkles
} from 'lucide-react'

export const ExportDialog: React.FC = () => {
  const isExportDialogOpen = useUi((state) => state.isExportDialogOpen)
  const setExportDialogOpen = useUi((state) => state.setExportDialogOpen)
  const addToast = useUi((state) => state.addToast)

  const doc = useProject((state) => state.doc)
  const setPageGrayscale = useProject((state) => state.setPageGrayscale)

  // State
  const [destination, setDestination] = useState<'pdf' | 'print'>('pdf')
  const [quality, setQuality] = useState<'max' | 'high' | 'balanced' | 'small'>('high')
  const [targetSizeMb, setTargetSizeMb] = useState<string>('')
  const [showScaleBar, setShowScaleBar] = useState(doc.settings.showScaleBar)
  const [showCutGuides, setShowCutGuides] = useState(doc.settings.showCutGuides)
  const [pageSelection, setPageSelection] = useState<'all' | 'current' | 'custom'>('all')
  const [customRangeText, setCustomRangeText] = useState('')
  const [colorMode, setColorMode] = useState<'as-is' | 'bw' | 'split'>('as-is')

  // Preview Stage State
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [previewZoom, setPreviewZoom] = useState(55) // default ~55% fits A4 nicely in preview
  const [thumbnailFilter, setThumbnailFilter] = useState<'all' | 'color' | 'bw'>('all')

  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const isCancelledRef = useRef(false)
  const previewStageRef = useRef<HTMLDivElement>(null)

  const basePxPerMm = 96 / MM_PER_INCH

  // Total pages calculation
  const totalPages = useMemo(() => {
    if (doc.settings.mode === 'freeform') {
      return Math.max(1, Math.max(0, ...doc.images.map((i) => i.placement?.pageIndex ?? 0)) + 1)
    }
    if (doc.settings.mode === 'exact') {
      const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
      const packed = packExactSheet({
        cellW: preset.w,
        cellH: preset.h,
        pageW: A4_WIDTH_MM,
        pageH: A4_HEIGHT_MM,
        marginMm: doc.settings.marginMm,
        spacingMm: doc.settings.gutterMm,
        itemCount: doc.images.length,
        isCardFrontBack: preset.isSpecialStack
      })
      return Math.max(1, packed.length)
    }
    return Math.max(1, doc.pages.length)
  }, [doc])

  // Pre-calculate page leaf assignments for flexible mode
  const leafAssignments = useMemo(() => {
    return getLeafAssignments(doc.pages, doc.images)
  }, [doc.pages, doc.images])

  const pageImagesMap = useMemo(() => {
    const map = new Map<number, ImageItem[]>()
    if (doc.settings.mode === 'freeform') {
      for (let p = 0; p < totalPages; p++) {
        map.set(
          p,
          doc.images.filter((img) => (img.placement?.pageIndex ?? 0) === p && img.kind !== 'blank')
        )
      }
    } else if (doc.settings.mode === 'exact') {
      const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
      const packed = packExactSheet({
        cellW: preset.w,
        cellH: preset.h,
        pageW: A4_WIDTH_MM,
        pageH: A4_HEIGHT_MM,
        marginMm: doc.settings.marginMm,
        spacingMm: doc.settings.gutterMm,
        itemCount: doc.images.length,
        isCardFrontBack: preset.isSpecialStack
      })
      packed.forEach((page, pIdx) => {
        const pageImgs: ImageItem[] = []
        page.cells.forEach((_, cIdx) => {
          const imgIdx = pIdx * page.cells.length + cIdx
          const img = doc.images[imgIdx]
          if (img && img.kind !== 'blank') pageImgs.push(img)
        })
        map.set(pIdx, pageImgs)
      })
    } else {
      leafAssignments.forEach((a) => {
        if (a.image && a.image.kind !== 'blank') {
          const list = map.get(a.pageIndex) || []
          list.push(a.image)
          map.set(a.pageIndex, list)
        }
      })
    }
    return map
  }, [doc, totalPages, leafAssignments])

  // Color vs B&W classification per page
  const pageColorStats = useMemo(() => {
    const colorIndices: number[] = []
    const bwIndices: number[] = []

    for (let p = 0; p < totalPages; p++) {
      const imgs = pageImagesMap.get(p) || []
      const hasColor = imgs.some((img) => !img.edit.filters.grayscale)
      if (hasColor) {
        colorIndices.push(p)
      } else {
        bwIndices.push(p)
      }
    }
    return { colorIndices, bwIndices }
  }, [totalPages, pageImagesMap])

  // Filtered page list for left thumbnail bar
  const visiblePageIndices = useMemo(() => {
    const all = Array.from({ length: totalPages }, (_, i) => i)
    if (thumbnailFilter === 'color') {
      return all.filter((i) => pageColorStats.colorIndices.includes(i))
    }
    if (thumbnailFilter === 'bw') {
      return all.filter((i) => pageColorStats.bwIndices.includes(i))
    }
    return all
  }, [totalPages, thumbnailFilter, pageColorStats])

  // Auto-fit preview zoom on mount
  useEffect(() => {
    if (!isExportDialogOpen || !previewStageRef.current) return
    const stage = previewStageRef.current
    const availW = Math.max(200, stage.clientWidth - 48)
    const availH = Math.max(200, stage.clientHeight - 48)
    const pageWPx = A4_WIDTH_MM * basePxPerMm
    const pageHPx = A4_HEIGHT_MM * basePxPerMm
    const fitZoom = Math.min(availW / pageWPx, availH / pageHPx) * 100
    setPreviewZoom(Math.max(25, Math.min(100, Math.round(fitZoom))))
  }, [isExportDialogOpen, basePxPerMm])

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

  // Parse custom range (e.g. "1, 3-4") into 0-based page index array
  const parseCustomPageRange = (text: string, total: number): number[] => {
    const indices = new Set<number>()
    const parts = text.split(',').map((p) => p.trim())
    for (const part of parts) {
      if (!part) continue
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim())
        const start = parseInt(startStr, 10)
        const end = parseInt(endStr, 10)
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(1, start); p <= Math.min(total, end); p++) {
            indices.add(p - 1)
          }
        }
      } else {
        const p = parseInt(part, 10)
        if (!isNaN(p) && p >= 1 && p <= total) {
          indices.add(p - 1)
        }
      }
    }
    return Array.from(indices).sort((a, b) => a - b)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setProgress(5)
    setStatusText('Preparing documents for export...')
    isCancelledRef.current = false

    try {
      const today = new Date().toISOString().slice(0, 10)
      const baseFilename = `SheetFit-${today}`

      // Determine target pages
      let selectedRange: 'all' | 'current' | number[] = 'all'
      if (pageSelection === 'current') {
        selectedRange = [activePageIndex]
      } else if (pageSelection === 'custom') {
        const parsed = parseCustomPageRange(customRangeText, totalPages)
        if (parsed.length === 0) {
          throw new Error('Please enter a valid page range (e.g. 1, 3-4)')
        }
        selectedRange = parsed
      }

      // Case 1: Split into 2 PDFs (Color + B&W) for Xerox shop optimization
      if (colorMode === 'split') {
        const { colorIndices, bwIndices } = pageColorStats

        if (colorIndices.length === 0 || bwIndices.length === 0) {
          addToast({
            title: 'Split Not Required',
            description:
              colorIndices.length === 0
                ? 'All pages are Black & White. Exporting single B&W document.'
                : 'All pages are Color. Exporting single Color document.',
            type: 'info'
          })
        }

        // Build Color PDF if pages exist
        let colorBytes: Uint8Array | null = null
        if (colorIndices.length > 0) {
          setStatusText(`Building Color PDF (${colorIndices.length} pages)...`)
          colorBytes = await buildPdf(doc, {
            jpegQuality: getQualityValue(),
            showScaleBar,
            showCutGuides,
            pageRange: colorIndices,
            onProgress: (p) => setProgress(Math.round(p * 0.5)),
            isCancelled: () => isCancelledRef.current
          })
        }

        // Build B&W PDF if pages exist
        let bwBytes: Uint8Array | null = null
        if (bwIndices.length > 0) {
          setStatusText(`Building Black & White PDF (${bwIndices.length} pages)...`)
          bwBytes = await buildPdf(doc, {
            jpegQuality: getQualityValue(),
            showScaleBar,
            showCutGuides,
            pageRange: bwIndices,
            forceGrayscale: true,
            onProgress: (p) => setProgress(50 + Math.round(p * 0.5)),
            isCancelled: () => isCancelledRef.current
          })
        }

        if (window.api) {
          const saveBase = await window.api.saveFileDialog({
            title: 'Save Color & B&W PDF Documents',
            defaultPath: `${baseFilename}.pdf`,
            filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
          })

          if (saveBase) {
            const dir = saveBase.replace(/\.pdf$/i, '')
            let savedMsg = ''

            if (colorBytes) {
              const colorPath = `${dir}-Color-Pages.pdf`
              await window.api.writeFile(colorPath, colorBytes)
              savedMsg += `Color (${colorIndices.length} pgs)`
            }
            if (bwBytes) {
              const bwPath = `${dir}-BW-Pages.pdf`
              await window.api.writeFile(bwPath, bwBytes)
              savedMsg += (savedMsg ? ' & ' : '') + `B&W (${bwIndices.length} pgs)`
            }

            addToast({
              title: 'Exported Separate PDFs for Print Shop',
              description: `Saved: ${savedMsg}`,
              type: 'success',
              actionLabel: 'Open Folder',
              onAction: () => {
                window.api?.revealInFolder(saveBase)
              }
            })
            setExportDialogOpen(false)
          }
        } else {
          // Fallback browser download
          if (colorBytes) {
            const blobC = new Blob([colorBytes as unknown as BlobPart], { type: 'application/pdf' })
            const urlC = URL.createObjectURL(blobC)
            const aC = document.createElement('a')
            aC.href = urlC
            aC.download = `${baseFilename}-Color-Pages.pdf`
            aC.click()
            URL.revokeObjectURL(urlC)
          }
          if (bwBytes) {
            const blobB = new Blob([bwBytes as unknown as BlobPart], { type: 'application/pdf' })
            const urlB = URL.createObjectURL(blobB)
            const aB = document.createElement('a')
            aB.href = urlB
            aB.download = `${baseFilename}-BW-Pages.pdf`
            aB.click()
            URL.revokeObjectURL(urlB)
          }
          addToast({ title: 'Exported Color & B&W PDFs', type: 'success' })
          setExportDialogOpen(false)
        }
        return
      }

      // Case 2: Standard Unified PDF (with optional target size or all-B&W override)
      let pdfBytes: Uint8Array
      const forceGrayscale = colorMode === 'bw'

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
          pageRange: selectedRange,
          forceGrayscale,
          onProgress: (p, s) => {
            setProgress(p)
            setStatusText(s)
          },
          isCancelled: () => isCancelledRef.current
        })
      }

      // If Direct Print chosen
      if (destination === 'print') {
        if (window.api) {
          const tempPath = await window.api.getTempPdfPath()
          await window.api.writeFile(tempPath, pdfBytes)
          await window.api.openPath(tempPath)
          addToast({
            title: 'Opened in PDF Viewer for Printing',
            description: 'Print at 100% / Actual Size for exact millimeter scale.',
            type: 'info'
          })
          setExportDialogOpen(false)
        } else {
          window.print()
          setExportDialogOpen(false)
        }
        return
      }

      // Standard Save to File
      if (window.api) {
        const defaultName = forceGrayscale ? `${baseFilename}-Grayscale.pdf` : `${baseFilename}.pdf`
        const savePath = await window.api.saveFileDialog({
          title: 'Save PDF Document',
          defaultPath: defaultName,
          filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
        })

        if (savePath) {
          await window.api.writeFile(savePath, pdfBytes)
          addToast({
            title: 'PDF Exported Successfully',
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
        const defaultName = forceGrayscale ? `${baseFilename}-Grayscale.pdf` : `${baseFilename}.pdf`
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

  const handleFitPage = () => {
    if (!previewStageRef.current) return
    const stage = previewStageRef.current
    const availW = Math.max(200, stage.clientWidth - 48)
    const availH = Math.max(200, stage.clientHeight - 48)
    const pageWPx = A4_WIDTH_MM * basePxPerMm
    const pageHPx = A4_HEIGHT_MM * basePxPerMm
    const fitZoom = Math.min(availW / pageWPx, availH / pageHPx) * 100
    setPreviewZoom(Math.max(25, Math.min(100, Math.round(fitZoom))))
  }

  const handleFitWidth = () => {
    if (!previewStageRef.current) return
    const stage = previewStageRef.current
    const availW = Math.max(200, stage.clientWidth - 48)
    const pageWPx = A4_WIDTH_MM * basePxPerMm
    const fitZoom = (availW / pageWPx) * 100
    setPreviewZoom(Math.max(25, Math.min(150, Math.round(fitZoom))))
  }

  // Active page preview data
  const activePageImages = pageImagesMap.get(activePageIndex) || []
  const isGlobalGrayscale = colorMode === 'bw'

  const activePageTree =
    doc.pages[activePageIndex]?.tree || { id: 'leaf-0', type: 'leaf' as const }
  const previewContentRect = {
    x: doc.settings.marginMm,
    y: doc.settings.marginMm,
    w: A4_WIDTH_MM - 2 * doc.settings.marginMm,
    h: A4_HEIGHT_MM - 2 * doc.settings.marginMm
  }
  const previewLayout = computeLayout(activePageTree, previewContentRect, doc.settings.gutterMm)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-5 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-[96vw] xl:max-w-7xl h-[92vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-100">
        {/* Header Bar */}
        <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 px-5 flex items-center justify-between shrink-0 bg-neutral-50/70 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Print Preview & Document Export</h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>A4 (210 × 297 mm)</span>
                <span>•</span>
                <span>{totalPages} {totalPages === 1 ? 'Page' : 'Pages'}</span>
                <span>•</span>
                <span className="text-purple-600 dark:text-purple-400 font-medium">
                  {pageColorStats.colorIndices.length} Color
                </span>
                <span>,</span>
                <span className="text-neutral-500">
                  {pageColorStats.bwIndices.length} B&W
                </span>
              </div>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={() => setExportDialogOpen(false)}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Main Body (3 Panes: Left Thumbnails, Center Preview Stage, Right Export Settings) */}
        <div className="flex flex-1 overflow-hidden">
          {/* 1. Left Thumbnail Bar (Edge/Chrome style) */}
          <div className="w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex flex-col overflow-hidden">
            {/* Filter Tabs */}
            <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setThumbnailFilter('all')}
                className={`flex-1 py-1 rounded font-medium transition-colors ${
                  thumbnailFilter === 'all'
                    ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                All ({totalPages})
              </button>
              <button
                onClick={() => setThumbnailFilter('color')}
                className={`flex-1 py-1 rounded font-medium transition-colors ${
                  thumbnailFilter === 'color'
                    ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Color ({pageColorStats.colorIndices.length})
              </button>
              <button
                onClick={() => setThumbnailFilter('bw')}
                className={`flex-1 py-1 rounded font-medium transition-colors ${
                  thumbnailFilter === 'bw'
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                B&W ({pageColorStats.bwIndices.length})
              </button>
            </div>

            {/* Thumbnail Scroll List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {visiblePageIndices.map((pIdx) => {
                const isActive = activePageIndex === pIdx
                const isColor = pageColorStats.colorIndices.includes(pIdx)

                return (
                  <div
                    key={pIdx}
                    onClick={() => setActivePageIndex(pIdx)}
                    className={`group p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {/* Mini Page Canvas */}
                    <div className="w-28 h-40 bg-white border border-neutral-300 dark:border-neutral-700 shadow-xs rounded-xs overflow-hidden relative flex items-center justify-center">
                      <div
                        className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-400 font-mono"
                        style={{
                          filter: isColor && !isGlobalGrayscale ? 'none' : 'grayscale(100%)'
                        }}
                      >
                        {/* Mini preview graphics */}
                        <div className="w-full h-full p-2 grid grid-cols-2 gap-1 opacity-70">
                          <div className="bg-neutral-200 dark:bg-neutral-800 rounded-xs" />
                          <div className="bg-neutral-300 dark:bg-neutral-700 rounded-xs" />
                          <div className="bg-neutral-300 dark:bg-neutral-700 rounded-xs" />
                          <div className="bg-neutral-200 dark:bg-neutral-800 rounded-xs" />
                        </div>
                      </div>
                    </div>

                    {/* Page Label & Color Badge */}
                    <div className="w-full flex items-center justify-between text-xs px-1">
                      <span className="font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        Page {pIdx + 1}
                      </span>

                      {/* Color/B&W Badge & Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setPageGrayscale(pIdx, isColor)
                        }}
                        title={isColor ? 'Convert page to B&W' : 'Restore color'}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase transition-colors ${
                          isColor
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300'
                        }`}
                      >
                        {isColor ? 'Color' : 'B&W'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. Center Stage (Interactive Document Viewer) */}
          <div
            ref={previewStageRef}
            className="flex-1 bg-neutral-200/80 dark:bg-neutral-950 flex flex-col items-center justify-between p-6 relative overflow-auto"
          >
            {/* The Scaled A4 Sheet Viewer */}
            <div className="my-auto flex items-center justify-center select-none">
              <div
                className="relative overflow-hidden shadow-2xl dark:shadow-black/90 rounded-xs border border-neutral-300 dark:border-neutral-800"
                style={{
                  width: `${A4_WIDTH_MM * basePxPerMm * (previewZoom / 100)}px`,
                  height: `${A4_HEIGHT_MM * basePxPerMm * (previewZoom / 100)}px`
                }}
              >
                {/* Millimeter Sheet scaled via CSS Transform */}
                <div
                  className="absolute top-0 left-0 bg-white select-none origin-top-left"
                  style={{
                    width: `${A4_WIDTH_MM}mm`,
                    height: `${A4_HEIGHT_MM}mm`,
                    transform: `scale(${previewZoom / 100})`,
                    transformOrigin: 'top left',
                    filter: isGlobalGrayscale ? 'grayscale(100%)' : 'none'
                  }}
                >
                  {/* Mode-specific preview rendering */}
                  {doc.settings.mode === 'freeform' ? (
                    // Freeform Mode
                    <>
                      {/* Margin line guide */}
                      <div
                        className="absolute pointer-events-none border border-dashed border-neutral-300/60"
                        style={{
                          left: '10mm',
                          top: '10mm',
                          width: `${A4_WIDTH_MM - 20}mm`,
                          height: `${A4_HEIGHT_MM - 20}mm`
                        }}
                      />
                      {activePageImages.map((img) => {
                        const p = img.placement || { x: 20, y: 20, w: 80, h: 60, pageIndex: 0 }
                        const draw = computeDraw({ x: 0, y: 0, w: p.w, h: p.h }, img.edit, {
                          w: img.naturalW,
                          h: img.naturalH
                        })
                        const crop = img.edit.crop

                        return (
                          <div
                            key={img.id}
                            className="absolute overflow-hidden"
                            style={{
                              left: `${p.x}mm`,
                              top: `${p.y}mm`,
                              width: `${p.w}mm`,
                              height: `${p.h}mm`
                            }}
                          >
                            <div
                              className="w-full h-full relative overflow-hidden bg-white"
                              style={{
                                transform: `rotate(${draw.rotation}deg) scaleX(${draw.flipH ? -1 : 1}) scaleY(${draw.flipV ? -1 : 1})`,
                                filter: `${draw.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${draw.filters.brightness}) contrast(${draw.filters.contrast})`
                              }}
                            >
                              <img
                                src={img.proxyUrl || img.source}
                                alt={img.name}
                                className="absolute max-w-none block"
                                style={{
                                  width: `${(1 / (crop?.w || 1)) * 100}%`,
                                  height: `${(1 / (crop?.h || 1)) * 100}%`,
                                  left: `${-((crop?.x || 0) / (crop?.w || 1)) * 100}%`,
                                  top: `${-((crop?.y || 0) / (crop?.h || 1)) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    // Flexible Grid Mode
                    <>
                      {previewLayout.leafList.map((leaf, idx) => {
                        const img = activePageImages[idx]
                        if (!img || img.kind === 'blank') return null

                        const draw = computeDraw({ x: 0, y: 0, w: leaf.rect.w, h: leaf.rect.h }, img.edit, {
                          w: img.naturalW,
                          h: img.naturalH
                        })
                        const crop = img.edit.crop

                        return (
                          <div
                            key={leaf.id}
                            className="absolute overflow-hidden bg-white"
                            style={{
                              left: `${leaf.rect.x}mm`,
                              top: `${leaf.rect.y}mm`,
                              width: `${leaf.rect.w}mm`,
                              height: `${leaf.rect.h}mm`
                            }}
                          >
                            <div
                              className="absolute overflow-hidden pointer-events-none"
                              style={{
                                left: `${draw.destRect.x}mm`,
                                top: `${draw.destRect.y}mm`,
                                width: `${draw.destRect.w}mm`,
                                height: `${draw.destRect.h}mm`,
                                transform: `rotate(${draw.rotation}deg) scaleX(${draw.flipH ? -1 : 1}) scaleY(${draw.flipV ? -1 : 1})`,
                                filter: `${draw.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${draw.filters.brightness}) contrast(${draw.filters.contrast})`
                              }}
                            >
                              <img
                                src={img.proxyUrl || img.source}
                                alt={img.name}
                                className="absolute pointer-events-none max-w-none block"
                                style={{
                                  width: `${(1 / (crop?.w || 1)) * 100}%`,
                                  height: `${(1 / (crop?.h || 1)) * 100}%`,
                                  left: `${-((crop?.x || 0) / (crop?.w || 1)) * 100}%`,
                                  top: `${-((crop?.y || 0) / (crop?.h || 1)) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}

                      {/* Dotted Cut Guides if enabled */}
                      {showCutGuides && (
                        <>
                          {previewLayout.dividers.map((d) => (
                            <div
                              key={d.id}
                              className="absolute pointer-events-none border-neutral-400 border-dashed z-20"
                              style={
                                d.dir === 'cols'
                                  ? {
                                      left: `${d.coord}mm`,
                                      top: `${d.y}mm`,
                                      width: '1px',
                                      height: `${d.h}mm`,
                                      borderLeftWidth: '1px'
                                    }
                                  : {
                                      left: `${d.x}mm`,
                                      top: `${d.coord}mm`,
                                      width: `${d.w}mm`,
                                      height: '1px',
                                      borderTopWidth: '1px'
                                    }
                              }
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* 100mm Scale Bar if enabled */}
                  {showScaleBar && (
                    <div
                      className="absolute left-[10mm] bottom-[6mm] flex flex-col pointer-events-none select-none z-30"
                      style={{ width: '100mm' }}
                    >
                      <div className="w-full h-[0.5mm] bg-black/80 relative">
                        <div className="absolute left-0 top-0 h-[2.5mm] w-[0.5mm] bg-black/80" />
                        <div className="absolute left-1/2 top-0 h-[2.5mm] w-[0.5mm] bg-black/80" />
                        <div className="absolute right-0 top-0 h-[2.5mm] w-[0.5mm] bg-black/80" />
                      </div>
                      <span className="text-[2.2mm] text-neutral-600 font-mono mt-[0.5mm]">
                        100 mm ruler verification bar
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Viewer Floating Toolbar */}
            <div className="flex items-center gap-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-neutral-200 dark:border-neutral-800 text-xs">
              {/* Page Navigator */}
              <div className="flex items-center gap-1.5 pr-3 border-r border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setActivePageIndex(Math.max(0, activePageIndex - 1))}
                  disabled={activePageIndex === 0}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                  {activePageIndex + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setActivePageIndex(Math.min(totalPages - 1, activePageIndex + 1))}
                  disabled={activePageIndex === totalPages - 1}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewZoom(Math.max(25, previewZoom - 10))}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono w-9 text-center font-medium">{previewZoom}%</span>
                <button
                  onClick={() => setPreviewZoom(Math.min(150, previewZoom + 10))}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={handleFitPage}
                  className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-[11px]"
                >
                  Fit Page
                </button>
                <button
                  onClick={handleFitWidth}
                  className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-[11px]"
                >
                  Fit Width
                </button>
              </div>
            </div>
          </div>

          {/* 3. Right Settings Sidebar */}
          <div className="w-80 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 p-5 flex flex-col justify-between overflow-y-auto select-none text-xs">
            <div className="space-y-5">
              {/* Destination */}
              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-2">
                  Destination
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-200/80 dark:bg-neutral-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDestination('pdf')}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      destination === 'pdf'
                        ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save as PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestination('print')}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      destination === 'print'
                        ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Directly</span>
                  </button>
                </div>
              </div>

              {/* Pages to Export */}
              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-2">
                  Pages
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pageSelection"
                      checked={pageSelection === 'all'}
                      onChange={() => setPageSelection('all')}
                      className="accent-blue-600"
                    />
                    <span>All Pages ({totalPages})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pageSelection"
                      checked={pageSelection === 'current'}
                      onChange={() => setPageSelection('current')}
                      className="accent-blue-600"
                    />
                    <span>Current Page (Page {activePageIndex + 1})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pageSelection"
                      checked={pageSelection === 'custom'}
                      onChange={() => setPageSelection('custom')}
                      className="accent-blue-600"
                    />
                    <span>Custom Range:</span>
                  </label>
                  {pageSelection === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. 1, 3-4"
                      value={customRangeText}
                      onChange={(e) => setCustomRangeText(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                    />
                  )}
                </div>
              </div>

              {/* Color Handling & Xerox Shop Mode */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-2">
                  Color & Xerox Shop Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'as-is'}
                      onChange={() => setColorMode('as-is')}
                      className="accent-blue-600 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        Preserve Color (As Designed)
                      </span>
                      <p className="text-[11px] text-neutral-500">
                        Keep color photos in color and B&W photos in grayscale.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'bw'}
                      onChange={() => setColorMode('bw')}
                      className="accent-blue-600 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        Convert All to Black & White
                      </span>
                      <p className="text-[11px] text-neutral-500">
                        Converts the entire PDF to grayscale for cheap printing.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'split'}
                      onChange={() => setColorMode('split')}
                      className="accent-purple-600 mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Split into 2 PDFs (Color + B&W)
                      </span>
                      <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                        Creates separate Color & B&W PDFs so xerox shops print B&W pages at ₹1-2 instead of color rates!
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quality Presets */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1.5">
                  Image Quality
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'max', label: 'Max' },
                      { id: 'high', label: 'High' },
                      { id: 'balanced', label: 'Bal' },
                      { id: 'small', label: 'Small' }
                    ] as const
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQuality(q.id)}
                      className={`py-1.5 px-1 text-center rounded font-medium border text-[11px] transition-colors ${
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
                    className="w-20 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                  />
                  <span className="text-neutral-500">MB max</span>
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
                    Include Dotted Cut Guides
                  </span>
                </label>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
              {/* Progress Bar when exporting */}
              {isExporting && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {statusText || 'Rendering exact PDF...'}
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

              <div className="flex items-center justify-end gap-2.5">
                {isExporting ? (
                  <button
                    onClick={handleCancel}
                    className="w-full py-2.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 text-xs font-medium"
                  >
                    Cancel Export
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setExportDialogOpen(false)}
                      className="px-4 py-2.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all hover:scale-[1.02]"
                    >
                      {colorMode === 'split' ? (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Export 2 PDFs (Color + B&W)</span>
                        </>
                      ) : destination === 'print' ? (
                        <>
                          <Printer className="w-4 h-4" />
                          <span>Print Document</span>
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          <span>Export Exact PDF</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
