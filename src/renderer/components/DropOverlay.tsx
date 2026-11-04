import React from 'react'
import { UploadCloud } from 'lucide-react'

interface DropOverlayProps {
  isDragging: boolean
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-blue-600/10 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-150">
      <div className="w-full h-full max-w-4xl max-h-96 border-3 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center bg-white/80 dark:bg-neutral-900/80 shadow-2xl gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center animate-bounce">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
          Drop images here to layout
        </div>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          Supports JPG, PNG, WEBP, GIF, BMP, AVIF
        </div>
      </div>
    </div>
  )
}
