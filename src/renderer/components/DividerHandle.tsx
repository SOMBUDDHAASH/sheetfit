import React, { useRef, useState } from 'react'
import { ComputedDivider } from '../engine/layoutTree'
import { snapDividerPosition } from '../engine/snap'
import { roundPrecision } from '../engine/units'

interface DividerHandleProps {
  divider: ComputedDivider
  scale: number // screen pixels per mm
  otherDividerCoords: number[]
  onGuideChange: (coord?: number, dir?: 'cols' | 'rows') => void
  onLiveRatioChange: (splitId: string, ratio: number) => void
  onCommitRatioChange: (splitId: string, ratio: number) => void
  onResetSplit: (splitId: string) => void
}

export const DividerHandle: React.FC<DividerHandleProps> = ({
  divider,
  scale,
  otherDividerCoords,
  onGuideChange,
  onLiveRatioChange,
  onCommitRatioChange,
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
    const parentStart = divider.minCoord - divider.minRatio * (divider.maxCoord - divider.minCoord) / (divider.maxRatio - divider.minRatio)
    const parentExtent = (divider.maxCoord - divider.minCoord) / Math.max(0.001, divider.maxRatio - divider.minRatio)

    let rAfId: number | null = null

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
        onLiveRatioChange(divider.splitNodeId, snapRes.ratio)

        if (snapRes.isSnapped && snapRes.guideCoord !== undefined) {
          onGuideChange(snapRes.guideCoord, divider.dir)
        } else {
          onGuideChange(undefined)
        }

        const sizeAMm = roundPrecision(snapRes.ratio * parentExtent, 1)
        const sizeBMm = roundPrecision((1 - snapRes.ratio) * parentExtent, 1)
        setLiveBadge(`${sizeAMm} mm | ${sizeBMm} mm`)
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

      if (liveRatio !== null) {
        onCommitRatioChange(divider.splitNodeId, liveRatio)
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
      const parentExtent = (divider.maxCoord - divider.minCoord) / Math.max(0.001, divider.maxRatio - divider.minRatio)
      const deltaRatio = deltaMm / Math.max(1, parentExtent)
      const newRatio = Math.max(
        divider.minRatio,
        Math.min(divider.maxRatio, divider.ratio + deltaRatio)
      )
      onCommitRatioChange(divider.splitNodeId, newRatio)
    }
  }

  // Visual position in mm
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
      {/* Visual thin line & hover highlight */}
      <div
        className={`transition-colors duration-100 ${
          isCols ? 'w-[2px] h-full' : 'h-[2px] w-full'
        } ${
          isHovered || liveRatio !== null
            ? 'bg-blue-500 shadow-xs'
            : 'bg-transparent group-hover:bg-blue-400/80'
        }`}
      />

      {/* Floating live size badge during drag */}
      {liveBadge && (
        <div
          className="absolute z-40 px-2 py-1 rounded-md bg-neutral-900/90 text-white text-[11px] font-mono shadow-lg border border-neutral-700 pointer-events-none whitespace-nowrap"
          style={isCols ? { top: '50%', transform: 'translateY(-50%)' } : { left: '50%', transform: 'translateX(-50%)' }}
        >
          {liveBadge}
        </div>
      )}
    </div>
  )
}
