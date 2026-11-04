import React from 'react'

interface GuidesProps {
  contentRect: { x: number; y: number; w: number; h: number }
  safeAreaMm: number
  showSafeArea: boolean
  guideCoord?: number
  guideDir?: 'cols' | 'rows'
}

export const Guides: React.FC<GuidesProps> = ({
  contentRect,
  safeAreaMm,
  showSafeArea,
  guideCoord,
  guideDir
}) => {
  return (
    <>
      {/* Safe Area Guide (visual only, never exported) */}
      {showSafeArea && safeAreaMm > 0 && (
        <div
          className="absolute pointer-events-none border border-dashed border-red-400/40 z-20"
          style={{
            left: `${contentRect.x + safeAreaMm}mm`,
            top: `${contentRect.y + safeAreaMm}mm`,
            width: `${Math.max(0, contentRect.w - 2 * safeAreaMm)}mm`,
            height: `${Math.max(0, contentRect.h - 2 * safeAreaMm)}mm`
          }}
        />
      )}

      {/* Snap Guide Line during dragging */}
      {guideCoord !== undefined && guideDir && (
        <div
          className="absolute pointer-events-none bg-blue-500 z-30 shadow-sm"
          style={
            guideDir === 'cols'
              ? {
                  left: `${guideCoord}mm`,
                  top: `${contentRect.y}mm`,
                  width: '1px',
                  height: `${contentRect.h}mm`
                }
              : {
                  left: `${contentRect.x}mm`,
                  top: `${guideCoord}mm`,
                  width: `${contentRect.w}mm`,
                  height: '1px'
                }
          }
        />
      )}
    </>
  )
}
