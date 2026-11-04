import React, { useState, useRef, useEffect } from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { CropRect } from '../types'
import {
  displayCropToSource,
  sourceCropToDisplay,
  TransformOptions
} from '../engine/cropMath'
import { X, Check, ArrowLeftRight, RefreshCw } from 'lucide-react'

type AspectRatioPreset = 'free' | '1:1' | '4:3' | '16:9' | 'a4' | 'cell'

export const CropModal: React.FC = () => {
  const isCropModalOpen = useUi((state) => state.isCropModalOpen)
  const cropImageId = useUi((state) => state.cropImageId)
  const closeCropModal = useUi((state) => state.closeCropModal)

  const images = useProject((state) => state.doc.images)
  const updateImageEdit = useProject((state) => state.updateImageEdit)

  const image = images.find((i) => i.id === cropImageId)

  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>('cell')
  const [isSwapped, setIsSwapped] = useState(false)
  const [displayCrop, setDisplayCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })

  const containerRef = useRef<HTMLDivElement>(null)

  const transformOpt: TransformOptions = {
    rotation: image?.edit.rotation || 0,
    flipH: image?.edit.flipH || false,
    flipV: image?.edit.flipV || false
  }

  // Initialize display crop from image.edit.crop
  useEffect(() => {
    if (image) {
      if (image.edit.crop) {
        setDisplayCrop(sourceCropToDisplay(image.edit.crop, transformOpt))
      } else {
        setDisplayCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })
      }
    }
  }, [cropImageId])

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
  }, [isCropModalOpen, displayCrop, image])

  if (!isCropModalOpen || !image) return null

  const handleApply = () => {
    const sourceCrop = displayCropToSource(displayCrop, transformOpt)
    updateImageEdit(image.id, { crop: sourceCrop })
    closeCropModal()
  }

  const handleReset = () => {
    setDisplayCrop({ x: 0, y: 0, w: 1, h: 1 })
    updateImageEdit(image.id, { crop: null })
  }

  // Aspect ratio math
  const getTargetAspect = (): number | null => {
    if (aspectPreset === 'free') return null
    let ratio = 1
    if (aspectPreset === '1:1') ratio = 1
    else if (aspectPreset === '4:3') ratio = 4 / 3
    else if (aspectPreset === '16:9') ratio = 16 / 9
    else if (aspectPreset === 'a4') ratio = 210 / 297
    else if (aspectPreset === 'cell') ratio = 1.0 // default cell aspect

    return isSwapped ? 1 / ratio : ratio
  }

  // Handle dragging crop rectangle or corner handles
  const startDrag = (e: React.PointerEvent, handleType: string) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const startX = e.clientX
    const startY = e.clientY
    const initialCrop = { ...displayCrop }

    const targetAspect = getTargetAspect()

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const dx = (moveEvt.clientX - startX) / rect.width
      const dy = (moveEvt.clientY - startY) / rect.height

      let newCrop = { ...initialCrop }

      if (handleType === 'move') {
        newCrop.x = Math.max(0, Math.min(1 - newCrop.w, initialCrop.x + dx))
        newCrop.y = Math.max(0, Math.min(1 - newCrop.h, initialCrop.y + dy))
      } else {
        if (handleType.includes('r')) {
          newCrop.w = Math.max(0.1, Math.min(1 - initialCrop.x, initialCrop.w + dx))
        }
        if (handleType.includes('l')) {
          const right = initialCrop.x + initialCrop.w
          newCrop.x = Math.max(0, Math.min(right - 0.1, initialCrop.x + dx))
          newCrop.w = right - newCrop.x
        }
        if (handleType.includes('b')) {
          newCrop.h = Math.max(0.1, Math.min(1 - initialCrop.y, initialCrop.h + dy))
        }
        if (handleType.includes('t')) {
          const bottom = initialCrop.y + initialCrop.h
          newCrop.y = Math.max(0, Math.min(bottom - 0.1, initialCrop.y + dy))
          newCrop.h = bottom - newCrop.y
        }

        if (targetAspect) {
          // Constrain to aspect ratio
          newCrop.h = Math.min(1 - newCrop.y, newCrop.w / targetAspect)
          newCrop.w = newCrop.h * targetAspect
        }
      }

      setDisplayCrop(newCrop)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const pixelCropW = Math.round(displayCrop.w * image.naturalW)
  const pixelCropH = Math.round(displayCrop.h * image.naturalH)

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white">
        <div>
          <h2 className="text-base font-semibold">Crop Image</h2>
          <span className="text-xs text-neutral-400 font-mono">
            Output: {pixelCropW} × {pixelCropH} px
          </span>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-1.5 bg-neutral-900/80 p-1 rounded-lg border border-neutral-800">
          {(['cell', 'free', '1:1', '4:3', '16:9', 'a4'] as AspectRatioPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setAspectPreset(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium uppercase transition-colors ${
                aspectPreset === p
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setIsSwapped(!isSwapped)}
            title="Swap orientation"
            className="p-1 rounded text-neutral-400 hover:text-white"
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
      <div className="relative flex-1 flex items-center justify-center p-4 max-w-4xl w-full max-h-[70vh]">
        <div
          ref={containerRef}
          className="relative max-h-full max-w-full aspect-auto border border-neutral-700/50 shadow-2xl overflow-hidden"
          style={{ width: '600px', height: '400px' }}
        >
          {/* Base Image */}
          <img
            src={image.proxyUrl || image.source}
            alt="Source"
            className="w-full h-full object-contain pointer-events-none select-none"
            style={{
              transform: `rotate(${image.edit.rotation}deg) scaleX(${image.edit.flipH ? -1 : 1}) scaleY(${image.edit.flipV ? -1 : 1})`,
              filter: `${image.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${image.edit.filters.brightness}) contrast(${image.edit.filters.contrast})`
            }}
          />

          {/* Dimmed Overlay outside crop rect */}
          <div
            className="absolute inset-0 bg-black/60 pointer-events-none"
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
            className="absolute border border-white/90 cursor-move shadow-md"
            style={{
              left: `${displayCrop.x * 100}%`,
              top: `${displayCrop.y * 100}%`,
              width: `${displayCrop.w * 100}%`,
              height: `${displayCrop.h * 100}%`
            }}
          >
            {/* Rule of Thirds Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              <div className="border-r border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-b border-white/25" />
              <div className="border-r border-white/25" />
              <div className="border-r border-white/25" />
              <div />
            </div>

            {/* 8 Resizing Handles */}
            {['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].map((handle) => {
              const handleCursor =
                handle === 'tl' || handle === 'br'
                  ? 'nwse-resize'
                  : handle === 'tr' || handle === 'bl'
                  ? 'nesw-resize'
                  : handle === 't' || handle === 'b'
                  ? 'ns-resize'
                  : 'ew-resize'

              const handlePos: React.CSSProperties = {
                position: 'absolute',
                width: '10px',
                height: '10px',
                backgroundColor: 'white',
                border: '1px solid black',
                cursor: handleCursor,
                transform: 'translate(-50%, -50%)'
              }

              if (handle.includes('t')) handlePos.top = '0%'
              else if (handle.includes('b')) handlePos.top = '100%'
              else handlePos.top = '50%'

              if (handle.includes('l')) handlePos.left = '0%'
              else if (handle.includes('r')) handlePos.left = '100%'
              else handlePos.left = '50%'

              return (
                <div
                  key={handle}
                  style={handlePos}
                  onPointerDown={(e) => startDrag(e, handle)}
                />
              )
            })}
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>Apply Crop (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
