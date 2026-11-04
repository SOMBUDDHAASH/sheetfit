import React, { useRef, useState } from 'react'
import { ComputedDivider } from '../engine/layoutTree'
import { snapDividerPosition } from '../engine/snap'
import { roundPrecision } from '../engine/units'

export interface SplitRatioUpdate {
  splitId: string
  ratio: number
}

interface DividerHandleProps {
  divider: ComputedDivider
  scale: number // screen pixels per mm
  allDividers: ComputedDivider[]
  onGuideChange: (coord?: number, dir?: 'cols' | 'rows') => void
  onLiveRatiosChange: (updates: SplitRatioUpdate[]) => void
  onCommitRatiosChange: (updates: SplitRatioUpdate[]) => void
  onResetSplit: (splitId: string) => void
}

export const DividerHandle: React.FC<DividerHandleProps> = ({
  divider,
  scale,
  allDividers,
  onGuideChange,
  onLiveRatiosChange,
  onCommitRatiosChange,
  onResetSplit
}) => {
  const isDraggingRef = useRef(false)
  const [isHovered, setIsHovered] = useState(false)
  const [liveRatio, setLiveRatio] = useState<number | null>(null)
  const [liveBadge, setLiveBadge] = useState<string | null>(null)

  const isCols = divider.dir === 'cols'

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true

    const startClient = isCols ? e.clientX : e.clientY
    const startCoord = divider.coord
    const otherDividerCoords = allDividers
      .filter((d) => d.id !== divider.id && d.dir === divider.dir)
      .map((d) => d.coord)

    const parentExtent =
      (divider.maxCoord - divider.minCoord) / Math.max(0.001, divider.maxRatio - divider.minRatio)
    const parentStart = divider.coord - divider.ratio * parentExtent

    let rAfId: number | null = null
    let latestUpdates: SplitRatioUpdate[] = []

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingRef.current) return

      if (rAfId) cancelAnimationFrame(rAfId)
      rAfId = requestAnimationFrame(() => {
        const currentClient = isCols ? moveEvt.clientX : moveEvt.clientY
        const deltaMm = (currentClient - startClient) / Math.max(0.001, scale)
        const proposedCoord = startCoord + deltaMm

        const snapRes = snapDividerPosition(
          proposedCoord,
          parentStart,
          parentExtent,
          divider.minRatio,
          divider.maxRatio,
          otherDividerCoords,
          moveEvt.altKey
        )

        setLiveRatio(snapRes.ratio)

        // Check collinear dividers if Shift key held
        const updates: SplitRatioUpdate[] = [{ splitId: divider.splitNodeId, ratio: snapRes.ratio }]

        if (moveEvt.shiftKey) {
          allDividers.forEach((other) => {
            if (
              other.id !== divider.id &&
              other.dir === divider.dir &&
              Math.abs(other.coord - divider.coord) <= 0.5
            ) {
              const otherParentExtent =
                (other.maxCoord - other.minCoord) / Math.max(0.001, other.maxRatio - other.minRatio)
              const otherParentStart = other.coord - other.ratio * otherParentExtent
              const otherProposed = other.coord + deltaMm
              const otherSnap = snapDividerPosition(
                otherProposed,
                otherParentStart,
                otherParentExtent,
                other.minRatio,
                other.maxRatio,
                [],
                true // match directly
              )
              updates.push({ splitId: other.splitNodeId, ratio: otherSnap.ratio })
            }
          })
        }

        latestUpdates = updates
        onLiveRatiosChange(updates)

        if (snapRes.isSnapped && snapRes.guideCoord !== undefined) {
          onGuideChange(snapRes.guideCoord, divider.dir)
        } else {
          onGuideChange(undefined)
        }

        const sizeAMm = roundPrecision(snapRes.ratio * parentExtent, 1)
        const sizeBMm = roundPrecision((1 - snapRes.ratio) * parentExtent, 1)
        setLiveBadge(
          `${sizeAMm} mm | ${sizeBMm} mm${moveEvt.shiftKey ? ' (Collinear synchronized)' : ''}`
        )
      })
    }

    const handlePointerUp = (upEvt: PointerEvent) => {
      isDraggingRef.current = false
      if (rAfId) cancelAnimationFrame(rAfId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      onGuideChange(undefined)
      setLiveBadge(null)

      if (e.currentTarget.hasPointerCapture(upEvt.pointerId)) {
        e.currentTarget.releasePointerCapture(upEvt.pointerId)
      }

      if (latestUpdates.length > 0) {
        onCommitRatiosChange(latestUpdates)
        setLiveRatio(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onResetSplit(divider.splitNodeId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const stepMm = e.shiftKey ? 5 : 1
    let deltaMm = 0

    if (isCols) {
      if (e.key === 'ArrowLeft') deltaMm = -stepMm
      else if (e.key === 'ArrowRight') deltaMm = stepMm
    } else {
      if (e.key === 'ArrowUp') deltaMm = -stepMm
      else if (e.key === 'ArrowDown') deltaMm = stepMm
    }

    if (deltaMm !== 0) {
      e.preventDefault()
      const parentExtent =
        (divider.maxCoord - divider.minCoord) / Math.max(0.001, divider.maxRatio - divider.minRatio)
      const deltaRatio = deltaMm / Math.max(1, parentExtent)
      const newRatio = Math.max(
        divider.minRatio,
        Math.min(divider.maxRatio, divider.ratio + deltaRatio)
      )
      onCommitRatiosChange([{ splitId: divider.splitNodeId, ratio: newRatio }])
    }
  }

  const style: React.CSSProperties = isCols
    ? {
        left: `${divider.coord}mm`,
        top: `${divider.y}mm`,
        width: '14px',
        height: `${divider.h}mm`,
        transform: 'translateX(-50%)',
        cursor: 'col-resize'
      }
    : {
        left: `${divider.x}mm`,
        top: `${divider.coord}mm`,
        width: `${divider.w}mm`,
        height: '14px',
        transform: 'translateY(-50%)',
        cursor: 'row-resize'
      }

  return (
    <div
      tabIndex={0}
      role="separator"
      aria-orientation={isCols ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round((liveRatio ?? divider.ratio) * 100)}
      aria-label="Layout divider"
      className="absolute z-20 flex items-center justify-center outline-none select-none group"
      style={style}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`transition-colors duration-100 ${
          isCols ? 'w-[2px] h-full' : 'h-[2px] w-full'
        } ${
          isHovered || liveRatio !== null
            ? 'bg-blue-500 shadow-xs'
            : 'bg-transparent group-hover:bg-blue-400/80'
        }`}
      />

      {liveBadge && (
        <div
          className="absolute z-40 px-2 py-1 rounded-md bg-neutral-900/90 text-white text-[11px] font-mono shadow-lg border border-neutral-700 pointer-events-none whitespace-nowrap"
          style={
            isCols
              ? { top: '50%', transform: 'translateY(-50%)' }
              : { left: '50%', transform: 'translateX(-50%)' }
          }
        >
          {liveBadge}
        </div>
      )}
    </div>
  )
}
