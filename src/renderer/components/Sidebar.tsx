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
import { Trash, Plus, Images, ChevronLeft, ChevronRight, Palette } from 'lucide-react'

export const Sidebar: React.FC = () => {
  const images = useProject((state) => state.doc.images)
  const pages = useProject((state) => state.doc.pages)
  const reorderImages = useProject((state) => state.reorderImages)
  const clearAll = useProject((state) => state.clearAll)
  const insertBlankCell = useProject((state) => state.insertBlankCell)
  const groupByColor = useProject((state) => state.groupByColor)

  const selectedImageIds = useUi((state) => state.selectedImageIds)
  const isSidebarCollapsed = useUi((state) => state.isSidebarCollapsed)
  const toggleSidebar = useUi((state) => state.toggleSidebar)
  const addToast = useUi((state) => state.addToast)

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

  // Collapsed Sidebar Rail
  if (isSidebarCollapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/80 flex flex-col items-center py-3 select-none transition-all duration-200">
        <button
          onClick={toggleSidebar}
          title="Expand Queue (Ctrl+[)"
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors mb-3"
        >
          <ChevronRight className="w-4 h-4 text-blue-500" />
        </button>

        <div className="flex flex-col items-center gap-1 my-2">
          <Images className="w-4 h-4 text-neutral-400" />
          <span className="text-[11px] font-bold font-mono text-neutral-600 dark:text-neutral-400">
            {images.length}
          </span>
        </div>

        <button
          onClick={() => insertBlankCell()}
          title="Insert Blank Cell"
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors mt-auto"
        >
          <Plus className="w-4 h-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 flex flex-col h-full select-none transition-all duration-200">
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
          {images.length > 1 && (
            <button
              onClick={() => {
                groupByColor()
                addToast({
                  title: 'Grouped by Color',
                  description: 'Color pages placed first, B&W pages placed second.',
                  type: 'info'
                })
              }}
              title="Group by Color (Xerox shop optimization)"
              className="p-1 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
          )}

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

          {/* Shrink / Collapse Chevron */}
          <button
            onClick={toggleSidebar}
            title="Collapse Queue Sidebar (Ctrl+[)"
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ml-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
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
