import React, { useRef, useEffect } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { PageView } from './PageView'
import { getLeafAssignments } from '../engine/flow'
import { A4_WIDTH_MM, MM_PER_INCH } from '../engine/units'
import { packExactSheet, EXACT_PRESETS } from '../engine/exactSheet'
import { ImagePlus, Sparkles } from 'lucide-react'
import { importFromFiles } from '../io/importImages'

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const doc = useProject((state) => state.doc)
  const addImages = useProject((state) => state.addImages)

  const zoomPercent = useUi((state) => state.zoomPercent)
  const setZoomPercent = useUi((state) => state.setZoomPercent)
  const selectCell = useUi((state) => state.selectCell)
  const selectImage = useUi((state) => state.selectImage)
  const addToast = useUi((state) => state.addToast)

  // Standard 96 DPI screen scale: 96 / 25.4 = 3.7795 px/mm at 100%
  const basePxPerMm = 96 / MM_PER_INCH
  const scale = basePxPerMm * (zoomPercent / 100)

  // Zoom with Ctrl + Wheel
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 10 : -10
        setZoomPercent(zoomPercent + delta)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomPercent, setZoomPercent])

  // Deselect on clicking canvas background
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      selectCell(null)
      selectImage(null)
    }
  }

  // Handle files dropped directly into canvas empty state
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
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

  // Group leaf assignments by page index for flexible mode
  const assignments = getLeafAssignments(doc.pages, doc.images)
  const pageAssignmentsMap = new Map<number, (typeof doc.images[0] | undefined)[]>()
  assignments.forEach((a) => {
    const arr = pageAssignmentsMap.get(a.pageIndex) || []
    arr.push(a.image)
    pageAssignmentsMap.set(a.pageIndex, arr)
  })

  // Empty State
  if (doc.images.length === 0) {
    return (
      <div
        ref={containerRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex-1 h-full overflow-auto bg-neutral-100 dark:bg-neutral-950 flex flex-col items-center justify-center p-8 select-none"
      >
        <label
          htmlFor="canvas-empty-file-input"
          className="group max-w-lg w-full p-12 border-2 border-dashed border-neutral-300 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center bg-white/50 dark:bg-neutral-900/40 hover:bg-white dark:hover:bg-neutral-900 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer text-center"
        >
          <input
            id="canvas-empty-file-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                const items = await importFromFiles(files)
                if (items.length > 0) addImages(items)
              }
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
            <ImagePlus className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
            Drag & Drop Images Here
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 max-w-xs">
            Drop your photos or documents to start laying them out on A4 pages for exact print sizing.
          </p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Exact millimeter accuracy</span>
          </div>
        </label>
      </div>
    )
  }

  // Exact Mode Sheet View
  if (doc.settings.mode === 'exact') {
    const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
    const packedPages = packExactSheet({
      cellW: preset.w,
      cellH: preset.h,
      pageW: A4_WIDTH_MM,
      pageH: 297,
      marginMm: doc.settings.marginMm,
      spacingMm: doc.settings.gutterMm,
      itemCount: doc.images.length,
      isCardFrontBack: preset.isSpecialStack
    })

    return (
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="flex-1 h-full overflow-auto bg-neutral-200/70 dark:bg-neutral-950 flex flex-col items-center p-8 select-none"
      >
        {packedPages.map((page, pIdx) => (
          <div key={pIdx} className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-between pb-2 text-xs text-neutral-500 select-none"
              style={{ width: `${A4_WIDTH_MM * scale}px` }}
            >
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Page {pIdx + 1} of {packedPages.length} ({preset.name})
              </span>
            </div>

            <div
              className="relative bg-white shadow-xl dark:shadow-2xl dark:shadow-black/60 select-none"
              style={{
                width: `${A4_WIDTH_MM * scale}px`,
                height: `${297 * scale}px`,
                fontSize: `${scale}px`
              }}
            >
              {page.cells.map((cell, cIdx) => {
                const imgIdx = pIdx * page.cells.length + cIdx
                const img = doc.images[imgIdx]
                return (
                  <div
                    key={cIdx}
                    className="absolute overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                    style={{
                      left: `${cell.x}mm`,
                      top: `${cell.y}mm`,
                      width: `${cell.w}mm`,
                      height: `${cell.h}mm`
                    }}
                  >
                    {img && (
                      <img
                        src={img.proxyUrl || img.source}
                        alt={img.name}
                        className="w-full h-full object-cover"
                        style={{
                          transform: `rotate(${img.edit.rotation}deg) scaleX(${img.edit.flipH ? -1 : 1}) scaleY(${img.edit.flipV ? -1 : 1})`,
                          filter: `${img.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${img.edit.filters.brightness}) contrast(${img.edit.filters.contrast})`
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Flexible Layout Tree View
  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="flex-1 h-full overflow-auto bg-neutral-200/70 dark:bg-neutral-950 flex flex-col items-center p-8 select-none"
    >
      {doc.pages.map((page, index) => (
        <PageView
          key={page.id}
          page={page}
          pageIndex={index}
          totalPages={doc.pages.length}
          images={pageAssignmentsMap.get(index) || []}
          settings={doc.settings}
          scale={scale}
        />
      ))}
    </div>
  )
}
