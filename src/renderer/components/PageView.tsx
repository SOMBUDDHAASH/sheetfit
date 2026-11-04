import React, { useState } from 'react'
import { Page, ImageItem, Settings } from '../types'
import { computeLayout } from '../engine/layoutTree'
import { TEMPLATES } from '../engine/templates'
import { A4_WIDTH_MM, A4_HEIGHT_MM, MM_PER_INCH } from '../engine/units'
import { Cell } from './Cell'
import { DividerHandle, SplitRatioUpdate } from './DividerHandle'
import { Guides } from './Guides'
import { useProject } from '../store/useProject'
import { useUi } from '../store/useUi'
import { Wand2, LayoutGrid } from 'lucide-react'

interface PageViewProps {
  page: Page
  pageIndex: number
  totalPages: number
  images: (ImageItem | undefined)[]
  settings: Settings
  scale: number
}

export const PageView: React.FC<PageViewProps> = ({
  page,
  pageIndex,
  totalPages,
  images,
  settings,
  scale
}) => {
  const [guideState, setGuideState] = useState<{ coord?: number; dir?: 'cols' | 'rows' }>({})
  const [liveTree, setLiveTree] = useState<typeof page.tree | null>(null)

  const setPageTemplate = useProject((state) => state.setPageTemplate)
  const updateSplitRatio = useProject((state) => state.updateSplitRatio)
  const updateSplitRatios = useProject((state) => state.updateSplitRatios)
  const smartPackCurrentPage = useProject((state) => state.smartPackCurrentPage)
  const setPageGrayscale = useProject((state) => state.setPageGrayscale)

  const selectedCellId = useUi((state) => state.selectedCellId)
  const selectCell = useUi((state) => state.selectCell)
  const selectImage = useUi((state) => state.selectImage)
  const zoomPercent = useUi((state) => state.zoomPercent)

  const basePxPerMm = 96 / MM_PER_INCH
  const zoomFactor = zoomPercent / 100
  const containerW = A4_WIDTH_MM * basePxPerMm * zoomFactor
  const containerH = A4_HEIGHT_MM * basePxPerMm * zoomFactor

  // Check if page contains any color images
  const validImages = images.filter((img): img is ImageItem => !!img && img.kind !== 'blank')
  const isPageColor = validImages.some((img) => !img.edit.filters.grayscale)

  const contentRect = {
    x: settings.marginMm,
    y: settings.marginMm,
    w: A4_WIDTH_MM - 2 * settings.marginMm,
    h: A4_HEIGHT_MM - 2 * settings.marginMm
  }

  // Use live tree during drag, or committed page tree
  const activeTree = liveTree || page.tree
  const layout = computeLayout(activeTree, contentRect, settings.gutterMm)

  const handleLiveRatiosChange = (updates: SplitRatioUpdate[]) => {
    let current = page.tree
    const updateLocalTree = (node: any, splitId: string, ratio: number): any => {
      if (node.type === 'leaf') return node
      if (node.id === splitId) return { ...node, ratio }
      return {
        ...node,
        a: updateLocalTree(node.a, splitId, ratio),
        b: updateLocalTree(node.b, splitId, ratio)
      }
    }

    for (const u of updates) {
      current = updateLocalTree(current, u.splitId, u.ratio)
    }
    setLiveTree(current)
  }

  const handleCommitRatiosChange = (updates: SplitRatioUpdate[]) => {
    setLiveTree(null)
    if (updates.length === 1) {
      updateSplitRatio(page.id, updates[0].splitId, updates[0].ratio)
    } else if (updates.length > 1) {
      updateSplitRatios(page.id, updates)
    }
  }

  const handleResetSplit = (splitId: string) => {
    setLiveTree(null)
    updateSplitRatio(page.id, splitId, 0.5)
  }

  return (
    <div
      className="flex flex-col items-center mb-8 shrink-0 select-none"
      style={{ width: `${containerW}px` }}
    >
      {/* Page Header Bar */}
      <div className="flex items-center justify-between pb-2 text-xs text-neutral-500 dark:text-neutral-400 select-none w-full">
        <div className="flex items-center gap-2 font-medium">
          <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[11px]">
            Page {pageIndex + 1} of {totalPages}
          </span>

          {/* Color vs B&W Page Status */}
          {validImages.length > 0 && (
            <button
              onClick={() => setPageGrayscale(pageIndex, isPageColor)}
              title={isPageColor ? 'Click to convert all images on this page to B&W' : 'Click to restore color'}
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

          {page.customized && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Custom layout
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Smart Pack Page Button */}
          <button
            onClick={() => smartPackCurrentPage(page.id)}
            title="Auto-adjust split ratios to match image aspect ratios"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300 text-xs"
          >
            <Wand2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Smart Pack</span>
          </button>

          {/* Template Selector Dropdown */}
          <div className="relative flex items-center">
            <LayoutGrid className="w-3.5 h-3.5 absolute left-2 pointer-events-none text-neutral-400" />
            <select
              value={page.customized ? 'custom' : settings.preset}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setPageTemplate(page.id, e.target.value)
                }
              }}
              className="pl-7 pr-3 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-800 dark:text-neutral-200 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {page.customized && <option value="custom">Custom</option>}
              {Object.values(TEMPLATES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* A4 Page Viewport - Exact proportional scale */}
      <div
        className="relative overflow-hidden shadow-2xl dark:shadow-black/80 rounded-xs"
        style={{
          width: `${containerW}px`,
          height: `${containerH}px`
        }}
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
          {/* Leaf Cells */}
          {layout.leafList.map((leaf, idx) => {
            const img = images[idx]
            const isSelected = selectedCellId === leaf.id

            return (
              <Cell
                key={leaf.id}
                pageId={page.id}
                leafId={leaf.id}
                rect={leaf.rect}
                image={img}
                isSelected={isSelected}
                showSizeBadges={settings.showSizeBadges}
                onSelect={() => {
                  selectCell(leaf.id)
                  if (img) selectImage(img.id)
                }}
              />
            )
          })}

          {/* Divider Handles */}
          {layout.dividers.map((divider) => (
            <DividerHandle
              key={divider.id}
              divider={divider}
              scale={scale}
              allDividers={layout.dividers}
              onGuideChange={(coord, dir) => setGuideState({ coord, dir })}
              onLiveRatiosChange={handleLiveRatiosChange}
              onCommitRatiosChange={handleCommitRatiosChange}
              onResetSplit={handleResetSplit}
            />
          ))}

          {/* Guides (Safe area & snapping line) */}
          <Guides
            contentRect={contentRect}
            safeAreaMm={settings.safeAreaMm}
            showSafeArea={true}
            guideCoord={guideState.coord}
            guideDir={guideState.dir}
          />

          {/* Optional On-Screen 100mm Scale Bar */}
          {settings.showScaleBar && (
            <div
              className="absolute left-[10mm] bottom-[6mm] flex flex-col pointer-events-none select-none"
              style={{ width: '100mm' }}
            >
              <div className="w-full h-[0.5mm] bg-black/80 relative">
                <div className="absolute left-0 top-0 h-[2mm] w-[0.5mm] bg-black/80" />
                <div className="absolute left-1/2 top-0 h-[2mm] w-[0.5mm] bg-black/80" />
                <div className="absolute right-0 top-0 h-[2mm] w-[0.5mm] bg-black/80" />
              </div>
              <span className="text-[2.2mm] text-neutral-600 font-mono mt-[0.5mm]">
                100 mm ruler verification bar
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
