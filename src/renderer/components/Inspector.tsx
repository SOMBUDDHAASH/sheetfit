import React from 'react'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { FitMode, RotationAngle } from '../types'
import { calculateEffectiveDpi } from '../engine/dpi'
import {
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Maximize2,
  Minimize2,
  StretchHorizontal
} from 'lucide-react'

export const Inspector: React.FC = () => {
  const images = useProject((state) => state.doc.images)
  const updateImageEdit = useProject((state) => state.updateImageEdit)
  const batchUpdateImageEdits = useProject((state) => state.batchUpdateImageEdits)

  const selectedImageId = useUi((state) => state.selectedImageId)
  const selectedImageIds = useUi((state) => state.selectedImageIds)
  const openCropModal = useUi((state) => state.openCropModal)

  const selectedImage = images.find((img) => img.id === selectedImageId)
  const isMulti = selectedImageIds.length > 1

  if (!selectedImage) {
    return (
      <aside className="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 p-4 flex flex-col items-center justify-center text-center text-xs text-neutral-400 select-none">
        <Sliders className="w-8 h-8 opacity-30 mb-2" />
        <span className="font-medium">No selection</span>
        <span className="text-[11px] mt-1 text-neutral-400/80">
          Click an image cell or queue item to inspect and adjust parameters.
        </span>
      </aside>
    )
  }

  const edit = selectedImage.edit
  const dpi = calculateEffectiveDpi(selectedImage.naturalW, selectedImage.naturalH, 100, 100)

  const handleFit = (fit: FitMode) => {
    updateImageEdit(selectedImage.id, { fit })
  }

  const handleRotateCw = () => {
    const next = ((edit.rotation + 90) % 360) as RotationAngle
    updateImageEdit(selectedImage.id, { rotation: next })
  }

  const handleRotateCcw = () => {
    const next = ((edit.rotation + 270) % 360) as RotationAngle
    updateImageEdit(selectedImage.id, { rotation: next })
  }

  const handleFlipH = () => {
    updateImageEdit(selectedImage.id, { flipH: !edit.flipH })
  }

  const handleFlipV = () => {
    updateImageEdit(selectedImage.id, { flipV: !edit.flipV })
  }

  const handleApplyToSelected = () => {
    batchUpdateImageEdits(selectedImageIds, {
      fit: edit.fit,
      rotation: edit.rotation,
      flipH: edit.flipH,
      flipV: edit.flipV,
      filters: edit.filters
    })
  }

  const handleApplyToAll = () => {
    const allIds = images.map((i) => i.id)
    batchUpdateImageEdits(allIds, {
      fit: edit.fit,
      rotation: edit.rotation,
      flipH: edit.flipH,
      flipV: edit.flipV,
      filters: edit.filters
    })
  }

  return (
    <aside className="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 flex flex-col h-full overflow-y-auto select-none text-xs">
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate pr-2">
          {isMulti ? `${selectedImageIds.length} Images Selected` : selectedImage.name}
        </span>
        <span
          className={`shrink-0 font-mono font-medium ${
            dpi.level === 'low'
              ? 'text-red-500'
              : dpi.level === 'medium'
              ? 'text-amber-500'
              : 'text-emerald-500'
          }`}
          title={dpi.warning || `${dpi.dpi} DPI`}
        >
          {dpi.dpi} DPI
        </span>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Multi-selection Actions */}
        {isMulti && (
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
              Multi-Selection Actions
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleApplyToSelected}
                className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium"
              >
                Apply to Selected
              </button>
              <button
                onClick={handleApplyToAll}
                className="flex-1 px-2 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded text-[11px] font-medium"
              >
                Apply to All
              </button>
            </div>
          </div>
        )}

        {/* Fit Mode */}
        <div>
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-2">
            Fit Mode
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-200/70 dark:bg-neutral-800 rounded-lg">
            <button
              onClick={() => handleFit('contain')}
              className={`flex flex-col items-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                edit.fit === 'contain'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Contain
            </button>
            <button
              onClick={() => handleFit('cover')}
              className={`flex flex-col items-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                edit.fit === 'cover'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Cover
            </button>
            <button
              onClick={() => handleFit('stretch')}
              className={`flex flex-col items-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors ${
                edit.fit === 'stretch'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <StretchHorizontal className="w-3.5 h-3.5" />
              Stretch
            </button>
          </div>
        </div>

        {/* Rotation & Flip */}
        <div>
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-2">
            Transform
          </label>
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={handleRotateCcw}
              title="Rotate 90° CCW"
              className="p-2 flex flex-col items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotateCw}
              title="Rotate 90° CW"
              className="p-2 flex flex-col items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleFlipH}
              title="Flip Horizontal"
              className={`p-2 flex flex-col items-center justify-center rounded border transition-colors ${
                edit.flipH
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={handleFlipV}
              title="Flip Vertical"
              className={`p-2 flex flex-col items-center justify-center rounded border transition-colors ${
                edit.flipV
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <FlipVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoom Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Cell Zoom
            </label>
            <span className="font-mono text-[10px] text-neutral-400">
              {Math.round(edit.zoom * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={edit.zoom}
            onChange={(e) => updateImageEdit(selectedImage.id, { zoom: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Filters */}
        <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
            Image Filters
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={edit.filters.grayscale}
              onChange={(e) =>
                updateImageEdit(selectedImage.id, {
                  filters: { ...edit.filters, grayscale: e.target.checked }
                })
              }
              className="rounded accent-blue-600"
            />
            <span className="text-neutral-700 dark:text-neutral-300 text-xs">
              Black & White (Grayscale)
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-neutral-500">Brightness</span>
              <span className="font-mono text-[10px] text-neutral-400">
                {Math.round(edit.filters.brightness * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={edit.filters.brightness}
              onChange={(e) =>
                updateImageEdit(selectedImage.id, {
                  filters: { ...edit.filters, brightness: parseFloat(e.target.value) }
                })
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-neutral-500">Contrast</span>
              <span className="font-mono text-[10px] text-neutral-400">
                {Math.round(edit.filters.contrast * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={edit.filters.contrast}
              onChange={(e) =>
                updateImageEdit(selectedImage.id, {
                  filters: { ...edit.filters, contrast: parseFloat(e.target.value) }
                })
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Crop Modal Button */}
        <div className="pt-2">
          <button
            onClick={() => openCropModal(selectedImage.id)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-lg font-medium text-neutral-800 dark:text-neutral-200 transition-colors"
          >
            <Crop className="w-4 h-4 text-blue-500" />
            <span>Open Crop Tool</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
