import React, { useState } from 'react'
import { ImageItem } from '../types'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { computeDraw } from '../engine/drawRect'
import { A4_WIDTH_MM, A4_HEIGHT_MM, MM_PER_INCH, roundPrecision } from '../engine/units'
import { SizeBadge } from './SizeBadge'
import { AlignCenter } from 'lucide-react'

interface FreeformCanvasProps {
  scale?: number
}

export const FreeformCanvas: React.FC<FreeformCanvasProps> = () => {
  const doc = useProject((state) => state.doc)
  const updateImagePlacement = useProject((state) => state.updateImagePlacement)
  const setPageGrayscale = useProject((state) => state.setPageGrayscale)

  const selectedImageId = useUi((state) => state.selectedImageId)
  const selectImage = useUi((state) => state.selectImage)
  const zoomPercent = useUi((state) => state.zoomPercent)

  const basePxPerMm = 96 / MM_PER_INCH
  const zoomFactor = zoomPercent / 100
  const containerW = A4_WIDTH_MM * basePxPerMm * zoomFactor
  const containerH = A4_HEIGHT_MM * basePxPerMm * zoomFactor

  const [, setActiveDrag] = useState<{
    imageId: string
    type: 'move' | string
    startX: number
    startY: number
    initialX: number
    initialY: number
    initialW: number
    initialH: number
  } | null>(null)

  const [guideLine, setGuideLine] = useState<{ x?: number; y?: number }>({})

  // Compute number of pages needed for freeform images
  const maxPageIndex = Math.max(
    0,
    ...doc.images.map((img) => img.placement?.pageIndex ?? 0)
  )
  const pageIndices = Array.from({ length: maxPageIndex + 1 }, (_, i) => i)

  const handlePointerDown = (
    e: React.PointerEvent,
    img: ImageItem,
    type: 'move' | string
  ) => {
    e.stopPropagation()
    selectImage(img.id)

    const p = img.placement || { x: 20, y: 20, w: 80, h: 60, pageIndex: 0 }

    setActiveDrag({
      imageId: img.id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialX: p.x,
      initialY: p.y,
      initialW: p.w,
      initialH: p.h
    })

    const handlePointerMove = (moveEvt: PointerEvent) => {
      // Screen delta divided by actual screen pixels per mm gives exact physical mm
      const screenPxPerMm = basePxPerMm * zoomFactor
      const deltaMmX = (moveEvt.clientX - e.clientX) / screenPxPerMm
      const deltaMmY = (moveEvt.clientY - e.clientY) / screenPxPerMm

      let nextX = p.x
      let nextY = p.y
      let nextW = p.w
      let nextH = p.h

      if (type === 'move') {
        nextX = p.x + deltaMmX
        nextY = p.y + deltaMmY

        // Snap to center of page (within 2 mm)
        const centerX = (A4_WIDTH_MM - p.w) / 2
        const centerY = (A4_HEIGHT_MM - p.h) / 2
        let snappedX: number | undefined
        let snappedY: number | undefined

        if (Math.abs(nextX - centerX) <= 2) {
          nextX = centerX
          snappedX = A4_WIDTH_MM / 2
        }
        if (Math.abs(nextY - centerY) <= 2) {
          nextY = centerY
          snappedY = A4_HEIGHT_MM / 2
        }

        setGuideLine({ x: snappedX, y: snappedY })

        // Clamp inside page
        nextX = Math.max(0, Math.min(A4_WIDTH_MM - p.w, nextX))
        nextY = Math.max(0, Math.min(A4_HEIGHT_MM - p.h, nextY))
      } else {
        // Resizing from handles
        if (type.includes('r')) {
          nextW = Math.max(20, Math.min(A4_WIDTH_MM - p.x, p.w + deltaMmX))
        }
        if (type.includes('l')) {
          const right = p.x + p.w
          nextX = Math.max(0, Math.min(right - 20, p.x + deltaMmX))
          nextW = right - nextX
        }
        if (type.includes('b')) {
          nextH = Math.max(20, Math.min(A4_HEIGHT_MM - p.y, p.h + deltaMmY))
        }
        if (type.includes('t')) {
          const bottom = p.y + p.h
          nextY = Math.max(0, Math.min(bottom - 20, p.y + deltaMmY))
          nextH = bottom - nextY
        }
      }

      updateImagePlacement(img.id, {
        x: roundPrecision(nextX, 1),
        y: roundPrecision(nextY, 1),
        w: roundPrecision(nextW, 1),
        h: roundPrecision(nextH, 1)
      })
    }

    const handlePointerUp = () => {
      setActiveDrag(null)
      setGuideLine({})
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const handleCenterImage = (img: ImageItem) => {
    const p = img.placement || { x: 20, y: 20, w: 80, h: 60, pageIndex: 0 }
    updateImagePlacement(img.id, {
      x: roundPrecision((A4_WIDTH_MM - p.w) / 2, 1),
      y: roundPrecision((A4_HEIGHT_MM - p.h) / 2, 1)
    })
  }

  return (
    <div className="flex flex-col items-center select-none">
      {pageIndices.map((pIdx) => {
        const pageImages = doc.images.filter(
          (img) => (img.placement?.pageIndex ?? 0) === pIdx
        )
        const isPageColor = pageImages.some((img) => !img.edit.filters.grayscale)

        return (
          <div
            key={pIdx}
            className="flex flex-col items-center mb-8 shrink-0"
            style={{ width: `${containerW}px` }}
          >
            {/* Page Header Bar */}
            <div className="flex items-center justify-between pb-2 text-xs text-neutral-500 dark:text-neutral-400 select-none w-full">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                  Page {pIdx + 1} of {pageIndices.length} (A4: 210 × 297 mm)
                </span>

                {pageImages.length > 0 && (
                  <button
                    onClick={() => setPageGrayscale(pIdx, isPageColor)}
                    title={isPageColor ? 'Convert all images on this page to B&W' : 'Restore color'}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:scale-105"
                  >
                    {isPageColor ? (
                      <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-300/50 dark:border-purple-800 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Color Page
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                        B&W Page
                      </span>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
                {selectedImageId && pageImages.some((img) => img.id === selectedImageId) && (
                  <button
                    onClick={() => {
                      const sel = pageImages.find((img) => img.id === selectedImageId)
                      if (sel) handleCenterImage(sel)
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-700 dark:text-neutral-200 transition-colors"
                    title="Center Selected Image on A4 Page"
                  >
                    <AlignCenter className="w-3 h-3 text-blue-500" />
                    <span>Center on Page</span>
                  </button>
                )}
                <span>Freeform Move & Resize</span>
              </div>
            </div>

            {/* A4 Sheet Viewport Container */}
            <div
              className="relative overflow-hidden shadow-2xl dark:shadow-black/80 rounded-xs border border-neutral-300/70 dark:border-neutral-800"
              style={{
                width: `${containerW}px`,
                height: `${containerH}px`
              }}
              onClick={() => selectImage(null)}
            >
              {/* Physical A4 Sheet in Millimeters, scaled via CSS transform */}
              <div
                className="absolute top-0 left-0 bg-white select-none origin-top-left"
                style={{
                  width: `${A4_WIDTH_MM}mm`,
                  height: `${A4_HEIGHT_MM}mm`,
                  transform: `scale(${zoomFactor})`,
                  transformOrigin: 'top left'
                }}
              >
                {/* 10mm Printable Margin Outline Guide */}
                <div
                  className="absolute pointer-events-none border border-dashed border-neutral-300/60 dark:border-neutral-400/40"
                  style={{
                    left: '10mm',
                    top: '10mm',
                    width: `${A4_WIDTH_MM - 20}mm`,
                    height: `${A4_HEIGHT_MM - 20}mm`
                  }}
                />

                {/* Center Alignment Guides */}
                {guideLine.x !== undefined && (
                  <div
                    className="absolute top-0 bottom-0 w-[1px] bg-blue-500 z-30 pointer-events-none"
                    style={{ left: `${guideLine.x}mm` }}
                  />
                )}
                {guideLine.y !== undefined && (
                  <div
                    className="absolute left-0 right-0 h-[1px] bg-blue-500 z-30 pointer-events-none"
                    style={{ top: `${guideLine.y}mm` }}
                  />
                )}

                {/* Freeform Placed Images */}
                {pageImages.map((img) => {
                  const p = img.placement || { x: 20, y: 20, w: 80, h: 60, pageIndex: 0 }
                  const isSelected = selectedImageId === img.id
                  const draw = computeDraw({ x: 0, y: 0, w: p.w, h: p.h }, img.edit, {
                    w: img.naturalW,
                    h: img.naturalH
                  })
                  const crop = img.edit.crop

                  return (
                    <div
                      key={img.id}
                      onPointerDown={(e) => handlePointerDown(e, img, 'move')}
                      className={`absolute select-none cursor-move ${
                        isSelected
                          ? 'ring-2 ring-blue-500 z-20 shadow-xl'
                          : 'hover:ring-1 hover:ring-blue-400/50 z-10'
                      }`}
                      style={{
                        left: `${p.x}mm`,
                        top: `${p.y}mm`,
                        width: `${p.w}mm`,
                        height: `${p.h}mm`
                      }}
                    >
                      {/* Image Layer */}
                      <div
                        className="w-full h-full relative overflow-hidden pointer-events-none bg-white"
                        style={{
                          transform: `rotate(${draw.rotation}deg) scaleX(${draw.flipH ? -1 : 1}) scaleY(${draw.flipV ? -1 : 1})`,
                          filter: `${draw.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${draw.filters.brightness}) contrast(${draw.filters.contrast})`
                        }}
                      >
                        <img
                          src={img.proxyUrl || img.source}
                          alt={img.name}
                          draggable={false}
                          className="absolute pointer-events-none max-w-none block"
                          style={{
                            width: `${(1 / (crop?.w || 1)) * 100}%`,
                            height: `${(1 / (crop?.h || 1)) * 100}%`,
                            left: `${-((crop?.x || 0) / (crop?.w || 1)) * 100}%`,
                            top: `${-((crop?.y || 0) / (crop?.h || 1)) * 100}%`
                          }}
                        />
                      </div>

                      <SizeBadge wMm={p.w} hMm={p.h} visible={doc.settings.showSizeBadges || isSelected} />

                      {/* 8 Photoshop-style Resize Handles when selected */}
                      {isSelected && (
                        <>
                          {[
                            { id: 'tl', cursor: 'nwse-resize', pos: { left: 0, top: 0 } },
                            { id: 'tr', cursor: 'nesw-resize', pos: { right: 0, top: 0 } },
                            { id: 'bl', cursor: 'nesw-resize', pos: { left: 0, bottom: 0 } },
                            { id: 'br', cursor: 'nwse-resize', pos: { right: 0, bottom: 0 } },
                            { id: 't', cursor: 'ns-resize', pos: { left: '50%', top: 0 } },
                            { id: 'b', cursor: 'ns-resize', pos: { left: '50%', bottom: 0 } },
                            { id: 'l', cursor: 'ew-resize', pos: { left: 0, top: '50%' } },
                            { id: 'r', cursor: 'ew-resize', pos: { right: 0, top: '50%' } }
                          ].map(({ id, cursor, pos }) => (
                            <div
                              key={id}
                              onPointerDown={(e) => handlePointerDown(e, img, id)}
                              className="absolute z-30 p-1 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                              style={{
                                ...pos,
                                cursor,
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              <div className="w-2.5 h-2.5 bg-white border border-blue-600 rounded-xs shadow-sm hover:scale-125 transition-transform" />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
