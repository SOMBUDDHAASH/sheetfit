import React from 'react'
import { useUi } from '../store/useUi'
import { X, Keyboard } from 'lucide-react'

export const ShortcutsOverlay: React.FC = () => {
  const isShortcutsOpen = useUi((state) => state.isShortcutsOpen)
  const setShortcutsOpen = useUi((state) => state.setShortcutsOpen)

  if (!isShortcutsOpen) return null

  const shortcuts = [
    { key: 'Ctrl + O', label: 'Add / Import Images' },
    { key: 'Ctrl + S', label: 'Save Project (.sheetfit)' },
    { key: 'Ctrl + E', label: 'Export PDF Document' },
    { key: 'Ctrl + P', label: 'Print / Open in Viewer' },
    { key: 'Ctrl + Z', label: 'Undo' },
    { key: 'Ctrl + Y', label: 'Redo' },
    { key: 'Delete / Backspace', label: 'Delete selected image' },
    { key: 'R', label: 'Rotate image 90° clockwise' },
    { key: 'Ctrl + Scroll', label: 'Zoom workspace (25% - 300%)' },
    { key: 'Double-Click Divider', label: 'Reset split to 50 / 50' },
    { key: 'Arrow Keys on Divider', label: 'Nudge divider 1 mm (Shift = 5 mm)' },
    { key: 'Shift + Drag Divider', label: 'Move all collinear dividers together' },
    { key: 'Alt (during drag)', label: 'Disable snapping temporarily' },
    { key: '?', label: 'Open this shortcuts overlay' }
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
          {shortcuts.map((sc, i) => (
            <div key={i} className="py-2 flex items-center justify-between">
              <span className="text-neutral-600 dark:text-neutral-400">{sc.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setShortcutsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
