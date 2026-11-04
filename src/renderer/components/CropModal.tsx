import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { CropRect } from '../types'
import {
  displayCropToSource,
  sourceCropToDisplay,
  TransformOptions
} from '../engine/cropMath'
import { X, Check, ArrowLeftRight, RefreshCw, Crop as CropIcon } from 'lucide-react'

type AspectRatioPreset = 'free' | '1:1' | '4:3' | '16:9' | 'a4' | 'cell'

export const CropModal: React.FC = () => {
  const isCropModalOpen = useUi((state) => state.isCropModalOpen)
  const cropImageId = useUi((state) => state.cropImageId)
  const closeCropModal = useUi((state) => state.closeCropModal)

  const images = useProject((state) => state.doc.images)
  const updateImageEdit = useProject((state) => state.updateImageEdit)

  const image = images.find((i) => i.id === cropImageId)

  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>('free')
  const [isSwapped, setIsSwapped] = useState(false)
  const [displayCrop, setDisplayCrop] = useState<CropRect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })

  const [boxDimensions, setBoxDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 450
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<{
    handle: string
    startX: number
    startY: number
    startCrop: CropRect
  } | null>(null)

  const isRotated = image ? image.edit.rotation === 90 || image.edit.rotation === 270 : false
  const visualW = image ? (isRotated ? image.naturalH : image.naturalW) : 1000
  const visualH = image ? (isRotated ? image.naturalW : image.naturalH) : 1000
  const imgAspect = visualW / Math.max(1, visualH)

  const transformOpt: TransformOptions = {
    rotation: image?.edit.rotation || 0,
    flipH: image?.edit.flipH || false,
    flipV: image?.edit.flipV || false
  }

  // Calculate container box dimensions to perfectly fit image aspect ratio
  useEffect(() => {
    if (!isCropModalOpen || !image) return

    const maxW = Math.min(window.innerWidth * 0.75, 780)
    const maxH = Math.min(window.innerHeight * 0.65, 540)

    let w = maxW
    let h = maxW / imgAspect

    if (h > maxH) {
      h = maxH
      w = maxH * imgAspect
    }

    setBoxDimensions({ width: Math.round(w), height: Math.round(h) })

    if (image.edit.crop) {
      setDisplayCrop(sourceCropToDisplay(image.edit.crop, transformOpt))
    } else {
      setDisplayCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })
    }
  }, [isCropModalOpen, cropImageId, imgAspect])

  const getTargetAspect = useCallback((): number | null => {
    if (aspectPreset === 'free') return null
    let ratio = 1
    if (aspectPreset === '1:1') ratio = 1
    else if (aspectPreset === '4:3') ratio = 4 / 3
    else if (aspectPreset === '16:9') ratio = 16 / 9
    else if (aspectPreset === 'a4') ratio = 210 / 297
    else if (aspectPreset === 'cell') ratio = imgAspect

    return isSwapped ? 1 / ratio : ratio
  }, [aspectPreset, isSwapped, imgAspect])

  const handleApply = useCallback(() => {
    if (!image) return
    const sourceCrop = displayCropToSource(displayCrop, transformOpt)
    updateImageEdit(image.id, { crop: sourceCrop })
    closeCropModal()
  }, [image, displayCrop, transformOpt, updateImageEdit, closeCropModal])

  const handleReset = useCallback(() => {
    if (!image) return
    setDisplayCrop({ x: 0, y: 0, w: 1, h: 1 })
    updateImageEdit(image.id, { crop: null })
  }, [image, updateImageEdit])

  // Global mouse handlers for silky smooth crop dragging
  useEffect(() => {
    if (!isCropModalOpen) return

    const handlePointerMove = (e: PointerEvent) => {
      const active = isDraggingRef.current
      if (!active) return

      const boxW = boxDimensions.width
      const boxH = boxDimensions.height
      if (boxW <= 0 || boxH <= 0) return

      const dx = (e.clientX - active.startX) / boxW
      const dy = (e.clientY - active.startY) / boxH

      const start = active.startCrop
      let newCrop = { ...start }
      const handle = active.handle

      if (handle === 'move') {
        newCrop.x = Math.max(0, Math.min(1 - start.w, start.x + dx))
        newCrop.y = Math.max(0, Math.min(1 - start.h, start.y + dy))
      } else {
        if (handle.includes('r')) {
          newCrop.w = Math.max(0.05, Math.min(1 - start.x, start.w + dx))
        }
        if (handle.includes('l')) {
          const right = start.x + start.w
          newCrop.x = Math.max(0, Math.min(right - 0.05, start.x + dx))
          newCrop.w = right - newCrop.x
        }
        if (handle.includes('b')) {
          newCrop.h = Math.max(0.05, Math.min(1 - start.y, start.h + dy))
        }
        if (handle.includes('t')) {
          const bottom = start.y + start.h
          newCrop.y = Math.max(0, Math.min(bottom - 0.05, start.y + dy))
          newCrop.h = bottom - newCrop.y
        }

        const targetAspect = getTargetAspect()
        if (targetAspect) {
          // Constrain to aspect ratio
          const pixelTargetW = newCrop.w * visualW
          const pixelTargetH = pixelTargetW / targetAspect
          newCrop.h = Math.min(1 - newCrop.y, pixelTargetH / visualH)
          newCrop.w = (newCrop.h * visualH * targetAspect) / visualW
        }
      }

      setDisplayCrop(newCrop)
    }

    const handlePointerUp = () => {
      isDraggingRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isCropModalOpen, boxDimensions, visualW, visualH, getTargetAspect])

  // Keyboard shortcut listener: Enter = apply, Esc = cancel
  useEffect(() => {
    if (!isCropModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeCropModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCropModalOpen, handleApply, closeCropModal])

  if (!isCropModalOpen || !image) return null

  const startDrag = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    isDraggingRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...displayCrop }
    }
  }

  const pixelCropW = Math.round(displayCrop.w * visualW)
  const pixelCropH = Math.round(displayCrop.h * visualH)

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <CropIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Crop Image</h2>
            <span className="text-xs text-neutral-400 font-mono">
              Output: {pixelCropW} × {pixelCropH} px ({Math.round(displayCrop.w * 100)}% × {Math.round(displayCrop.h * 100)}%)
            </span>
          </div>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-lg border border-neutral-800">
          {(
            [
              { id: 'free', label: 'Free' },
              { id: '1:1', label: '1:1' },
              { id: '4:3', label: '4:3' },
              { id: '16:9', label: '16:9' },
              { id: 'a4', label: 'A4' }
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setAspectPreset(p.id)
                if (p.id !== 'free') {
                  const targetAspect = p.id === '1:1' ? 1 : p.id === '4:3' ? 4 / 3 : p.id === '16:9' ? 16 / 9 : 210 / 297
                  const ratio = isSwapped ? 1 / targetAspect : targetAspect
                  // Center crop according to aspect ratio
                  const cropW = 0.8
                  const cropH = (cropW * visualW) / (ratio * visualH)
                  if (cropH <= 0.9) {
                    setDisplayCrop({ x: (1 - cropW) / 2, y: (1 - cropH) / 2, w: cropW, h: cropH })
                  } else {
                    const newH = 0.8
                    const newW = (newH * visualH * ratio) / visualW
                    setDisplayCrop({ x: (1 - newW) / 2, y: (1 - newH) / 2, w: newW, h: newH })
                  }
                }
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium uppercase transition-colors ${
                aspectPreset === p.id
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => {
              setIsSwapped(!isSwapped)
              if (aspectPreset !== 'free') {
                const targetAspect = aspectPreset === '1:1' ? 1 : aspectPreset === '4:3' ? 4 / 3 : aspectPreset === '16:9' ? 16 / 9 : 210 / 297
                const ratio = !isSwapped ? 1 / targetAspect : targetAspect
                const cropW = 0.8
                const cropH = (cropW * visualW) / (ratio * visualH)
                if (cropH <= 0.9) {
                  setDisplayCrop({ x: (1 - cropW) / 2, y: (1 - cropH) / 2, w: cropW, h: cropH })
                }
              }
            }}
            title="Swap width & height orientation"
            className={`p-1.5 rounded transition-colors ${
              isSwapped ? 'bg-blue-500/30 text-blue-400' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={closeCropModal}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Crop Viewport */}
      <div className="relative flex-1 flex items-center justify-center p-4 max-w-4xl w-full">
        <div
          ref={containerRef}
          className="relative shadow-2xl border border-neutral-700 select-none overflow-hidden"
          style={{
            width: `${boxDimensions.width}px`,
            height: `${boxDimensions.height}px`
          }}
        >
          {/* Base Source Image */}
          <img
            src={image.proxyUrl || image.source}
            alt="Source"
            className="w-full h-full object-fill pointer-events-none select-none block"
            style={{
              transform: `rotate(${image.edit.rotation}deg) scaleX(${image.edit.flipH ? -1 : 1}) scaleY(${image.edit.flipV ? -1 : 1})`,
              filter: `${image.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${image.edit.filters.brightness}) contrast(${image.edit.filters.contrast})`
            }}
          />

          {/* Dimmed Overlay outside crop rect */}
          <div
            className="absolute inset-0 bg-black/65 pointer-events-none"
            style={{
              clipPath: `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                ${displayCrop.x * 100}% ${displayCrop.y * 100}%,
                ${(displayCrop.x + displayCrop.w) * 100}% ${displayCrop.y * 100}%,
                ${(displayCrop.x + displayCrop.w) * 100}% ${(displayCrop.y + displayCrop.h) * 100}%,
                ${displayCrop.x * 100}% ${(displayCrop.y + displayCrop.h) * 100}%,
                ${displayCrop.x * 100}% ${displayCrop.y * 100}%
              )`
            }}
          />

          {/* Interactive Crop Rectangle */}
          <div
            onPointerDown={(e) => startDrag(e, 'move')}
            className="absolute border-2 border-white cursor-move shadow-md z-20 group"
            style={{
              left: `${displayCrop.x * 100}%`,
              top: `${displayCrop.y * 100}%`,
              width: `${displayCrop.w * 100}%`,
              height: `${displayCrop.h * 100}%`
            }}
          >
            {/* Rule of Thirds Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-white/30" />
              <div className="border-r border-white/30" />
              <div />
            </div>

            {/* 8 Resizing Handles with large, comfortable hit-zones */}
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
                onPointerDown={(e) => startDrag(e, id)}
                className="absolute z-30 flex items-center justify-center p-2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  ...pos,
                  cursor,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="w-3 h-3 bg-white border border-neutral-900 rounded-xs shadow-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-4xl flex items-center justify-between text-xs pt-4 border-t border-neutral-800">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Crop</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={closeCropModal}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
          >
            Cancel (Esc)
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>Apply Crop (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
