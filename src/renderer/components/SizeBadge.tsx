import React from 'react'
import { roundPrecision } from '../engine/units'

interface SizeBadgeProps {
  wMm: number
  hMm: number
  visible?: boolean
}

export const SizeBadge: React.FC<SizeBadgeProps> = ({ wMm, hMm, visible = true }) => {
  if (!visible) return null

  return (
    <div className="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/90 shadow pointer-events-none select-none">
      {roundPrecision(wMm, 1)} × {roundPrecision(hMm, 1)} mm
    </div>
  )
}
