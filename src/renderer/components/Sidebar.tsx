import React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { QueueItem } from './QueueItem'
import { getLeafAssignments } from '../engine/flow'
import { Trash, Plus, Images } from 'lucide-react'

export const Sidebar: React.FC = () => {
  const images = useProject((state) => state.doc.images)
  const pages = useProject((state) => state.doc.pages)
  const reorderImages = useProject((state) => state.reorderImages)
  const clearAll = useProject((state) => state.clearAll)
  const insertBlankCell = useProject((state) => state.insertBlankCell)

  const selectedImageIds = useUi((state) => state.selectedImageIds)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderImages(String(active.id), String(over.id))
    }
  }

  // Pre-calculate page badge per image
  const assignments = getLeafAssignments(pages, images)
  const imagePageBadgeMap = new Map<string, string>()
  assignments.forEach((a) => {
    if (a.image) {
      imagePageBadgeMap.set(a.image.id, `P${a.pageIndex + 1}`)
    }
  })

  const allIds = images.map((img) => img.id)

  return (
    <aside className="w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 flex flex-col h-full select-none">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {images.length} {images.length === 1 ? 'image' : 'images'}
          </span>
          <span className="text-xs text-neutral-400">•</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => insertBlankCell()}
            title="Insert Blank Cell"
            className="p-1 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {images.length > 0 && (
            <button
              onClick={clearAll}
              title="Clear all (Undoable with Ctrl+Z)"
              className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {images.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-400 dark:text-neutral-500 text-xs">
            <span>No images in queue</span>
            <span className="text-[11px] mt-1 text-neutral-400/80">
              Drag images here or use Add Images
            </span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
              {images.map((image) => (
                <QueueItem
                  key={image.id}
                  image={image}
                  pageBadge={imagePageBadgeMap.get(image.id)}
                  isSelected={selectedImageIds.includes(image.id)}
                  allIds={allIds}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </aside>
  )
}
