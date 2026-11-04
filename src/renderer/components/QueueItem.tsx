import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ImageItem } from '../types'
import { calculateEffectiveDpi } from '../engine/dpi'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { Crop, RotateCw, Trash2, GripVertical } from 'lucide-react'

interface QueueItemProps {
  image: ImageItem
  pageBadge?: string
  isSelected: boolean
  allIds: string[]
}

export const QueueItem: React.FC<QueueItemProps> = ({
  image,
  pageBadge,
  isSelected,
  allIds
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: image.id })

  const removeImage = useProject((state) => state.removeImage)
  const updateImageEdit = useProject((state) => state.updateImageEdit)
  const selectImage = useUi((state) => state.selectImage)
  const openCropModal = useUi((state) => state.openCropModal)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  // DPI calculation assuming approx 100x100mm placement
  const dpi = calculateEffectiveDpi(image.naturalW, image.naturalH, 100, 100)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectImage(image.id, e.ctrlKey || e.metaKey, e.shiftKey, allIds)
  }

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextRotation = ((image.edit.rotation + 90) % 360) as 0 | 90 | 180 | 270
    updateImageEdit(image.id, { rotation: nextRotation })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeImage(image.id)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    openCropModal(image.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`group relative flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-100 cursor-pointer select-none text-xs ${
        isSelected
          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-xs'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-grab active:cursor-grabbing p-0.5 rounded touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Thumbnail */}
      <div className="w-11 h-11 shrink-0 rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 relative flex items-center justify-center">
        {image.kind === 'blank' ? (
          <span className="text-[10px] text-neutral-400 italic">Blank</span>
        ) : (
          <img
            src={image.proxyUrl || image.source}
            alt={image.name}
            className="w-full h-full object-cover"
            style={{
              transform: `rotate(${image.edit.rotation}deg) scaleX(${image.edit.flipH ? -1 : 1}) scaleY(${image.edit.flipV ? -1 : 1})`,
              filter: `${image.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${image.edit.filters.brightness}) contrast(${image.edit.filters.contrast})`
            }}
          />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 leading-none mb-1">
          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate" title={image.name}>
            {image.name}
          </span>
          {pageBadge && (
            <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {pageBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-neutral-400">
          <span>{image.naturalW}×{image.naturalH}</span>
          <span
            className={`font-medium ${
              dpi.level === 'low'
                ? 'text-red-500'
                : dpi.level === 'medium'
                ? 'text-amber-500'
                : 'text-emerald-500'
            }`}
            title={dpi.warning || `${dpi.dpi} DPI (good print quality)`}
          >
            {dpi.dpi} DPI
          </span>
        </div>
      </div>

      {/* Hover Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
        <button
          onClick={handleEdit}
          title="Crop image"
          className="p-1 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Crop className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleRotate}
          title="Rotate 90° CW"
          className="p-1 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          title="Delete image"
          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
