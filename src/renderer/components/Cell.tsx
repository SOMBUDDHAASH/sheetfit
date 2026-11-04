import React, { useState } from 'react'
import { Rect, ImageItem } from '../types'
import { computeDraw } from '../engine/drawRect'
import { SizeBadge } from './SizeBadge'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { Plus, RotateCw, SplitSquareVertical, SplitSquareHorizontal, Trash2, Unlink } from 'lucide-react'

interface CellProps {
  pageId: string
  leafId: string
  rect: Rect
  image?: ImageItem
  isSelected: boolean
  showSizeBadges: boolean
  onSelect: () => void
}

export const Cell: React.FC<CellProps> = ({
  pageId,
  leafId,
  rect,
  image,
  isSelected,
  showSizeBadges,
  onSelect
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const splitCell = useProject((state) => state.splitCell)
  const mergeCell = useProject((state) => state.mergeCell)
  const removeImage = useProject((state) => state.removeImage)
  const insertBlankCell = useProject((state) => state.insertBlankCell)
  const updateImageEdit = useProject((state) => state.updateImageEdit)
  const swapImages = useProject((state) => state.swapImages)
  const openCropModal = useUi((state) => state.openCropModal)

  // Drag and drop swap between cells
  const handleDragStart = (e: React.DragEvent) => {
    if (!image) return
    e.dataTransfer.setData('text/plain', image.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedImageId = e.dataTransfer.getData('text/plain')
    if (draggedImageId && image && draggedImageId !== image.id) {
      swapImages(draggedImageId, image.id)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Pure computeDraw for exact placement math
  const draw = image
    ? computeDraw({ x: 0, y: 0, w: rect.w, h: rect.h }, image.edit, {
        w: image.naturalW,
        h: image.naturalH
      })
    : null

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`absolute overflow-hidden cursor-pointer transition-shadow duration-100 ${
          isSelected
            ? 'ring-2 ring-blue-500 shadow-md z-10'
            : 'hover:ring-1 hover:ring-blue-400/50'
        } ${!image ? 'bg-neutral-50/50 dark:bg-neutral-900/30 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xs' : 'bg-white'}`}
        style={{
          left: `${rect.x}mm`,
          top: `${rect.y}mm`,
          width: `${rect.w}mm`,
          height: `${rect.h}mm`
        }}
      >
        {image && draw ? (
          <div
            draggable
            onDragStart={handleDragStart}
            className="w-full h-full relative select-none"
          >
            {image.kind === 'blank' ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Blank space
              </div>
            ) : (
              <img
                src={image.proxyUrl || image.source}
                alt={image.name}
                draggable={false}
                decoding="async"
                className="absolute pointer-events-none select-none max-w-none origin-center"
                style={{
                  left: `${draw.destRect.x}mm`,
                  top: `${draw.destRect.y}mm`,
                  width: `${draw.destRect.w}mm`,
                  height: `${draw.destRect.h}mm`,
                  transform: `rotate(${draw.rotation}deg) scaleX(${draw.flipH ? -1 : 1}) scaleY(${draw.flipV ? -1 : 1})`,
                  filter: `${draw.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${draw.filters.brightness}) contrast(${draw.filters.contrast})`
                }}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-neutral-400 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400 transition-colors select-none">
            <Plus className="w-5 h-5 opacity-40 mb-1" />
            <span className="text-[11px] font-medium opacity-60">Drop image here</span>
          </div>
        )}

        {/* Size Badge */}
        <SizeBadge wMm={rect.w} hMm={rect.h} visible={showSizeBadges} />
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 bg-neutral-900 text-neutral-100 rounded-lg shadow-2xl border border-neutral-700 py-1.5 text-xs animate-in fade-in duration-100 select-none"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 -z-10"
            onClick={closeContextMenu}
          />
          <button
            onClick={() => {
              splitCell(pageId, leafId, 'cols')
              closeContextMenu()
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-neutral-400" />
            Split Vertically (2 columns)
          </button>
          <button
            onClick={() => {
              splitCell(pageId, leafId, 'rows')
              closeContextMenu()
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5 text-neutral-400" />
            Split Horizontally (2 rows)
          </button>
          <button
            onClick={() => {
              mergeCell(pageId, leafId)
              closeContextMenu()
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
          >
            <Unlink className="w-3.5 h-3.5 text-neutral-400" />
            Merge with Neighbour
          </button>
          <div className="h-px bg-neutral-800 my-1" />
          <button
            onClick={() => {
              insertBlankCell(image?.id)
              closeContextMenu()
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-neutral-400" />
            Insert Blank Cell
          </button>
          {image && (
            <>
              <button
                onClick={() => {
                  const nextRot = ((image.edit.rotation + 90) % 360) as 0 | 90 | 180 | 270
                  updateImageEdit(image.id, { rotation: nextRot })
                  closeContextMenu()
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-neutral-400" />
                Rotate 90° CW
              </button>
              <button
                onClick={() => {
                  openCropModal(image.id)
                  closeContextMenu()
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 text-left transition-colors"
              >
                Crop Image...
              </button>
              <div className="h-px bg-neutral-800 my-1" />
              <button
                onClick={() => {
                  removeImage(image.id)
                  closeContextMenu()
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-950/40 text-red-400 text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Image
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
