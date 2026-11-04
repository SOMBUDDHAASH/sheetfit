import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  description?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

export interface UiState {
  theme: 'light' | 'dark' | 'system'
  zoomPercent: number // 25..300
  selectedImageId: string | null
  selectedImageIds: string[]
  selectedCellId: string | null
  isDraggingFiles: boolean
  isCropModalOpen: boolean
  cropImageId: string | null
  isExportDialogOpen: boolean
  isPrintTipDialogOpen: boolean
  isShortcutsOpen: boolean
  isExporting: boolean
  exportProgress: number // 0..100
  exportStatusText: string
  toasts: Toast[]

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setZoomPercent: (zoom: number) => void
  selectImage: (id: string | null, multi?: boolean, range?: boolean, allIds?: string[]) => void
  selectCell: (id: string | null) => void
  setIsDraggingFiles: (dragging: boolean) => void
  openCropModal: (imageId: string) => void
  closeCropModal: () => void
  setExportDialogOpen: (open: boolean) => void
  setPrintTipDialogOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setExporting: (exporting: boolean, progress?: number, statusText?: string) => void
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

export const useUi = create<UiState>((set, get) => ({
  theme: 'system',
  zoomPercent: 100,
  selectedImageId: null,
  selectedImageIds: [],
  selectedCellId: null,
  isDraggingFiles: false,
  isCropModalOpen: false,
  cropImageId: null,
  isExportDialogOpen: false,
  isPrintTipDialogOpen: false,
  isShortcutsOpen: false,
  isExporting: false,
  exportProgress: 0,
  exportStatusText: '',
  toasts: [],

  setTheme: (theme) => {
    set({ theme })
    // Apply dark class to documentElement
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  setZoomPercent: (zoom) => {
    set({ zoomPercent: Math.min(300, Math.max(25, Math.round(zoom))) })
  },

  selectImage: (id, multi = false, range = false, allIds = []) => {
    if (!id) {
      set({ selectedImageId: null, selectedImageIds: [] })
      return
    }

    const { selectedImageIds } = get()

    if (range && selectedImageIds.length > 0 && allIds.length > 0) {
      const lastSelected = selectedImageIds[selectedImageIds.length - 1]
      const idxA = allIds.indexOf(lastSelected)
      const idxB = allIds.indexOf(id)
      if (idxA !== -1 && idxB !== -1) {
        const start = Math.min(idxA, idxB)
        const end = Math.max(idxA, idxB)
        const rangeIds = allIds.slice(start, end + 1)
        set({
          selectedImageId: id,
          selectedImageIds: Array.from(new Set([...selectedImageIds, ...rangeIds]))
        })
        return
      }
    }

    if (multi) {
      const alreadySelected = selectedImageIds.includes(id)
      const newIds = alreadySelected
        ? selectedImageIds.filter((item) => item !== id)
        : [...selectedImageIds, id]
      set({
        selectedImageId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
        selectedImageIds: newIds
      })
    } else {
      set({
        selectedImageId: id,
        selectedImageIds: [id]
      })
    }
  },

  selectCell: (id) => {
    set({ selectedCellId: id })
  },

  setIsDraggingFiles: (isDraggingFiles) => {
    set({ isDraggingFiles })
  },

  openCropModal: (imageId) => {
    set({ isCropModalOpen: true, cropImageId: imageId })
  },

  closeCropModal: () => {
    set({ isCropModalOpen: false, cropImageId: null })
  },

  setExportDialogOpen: (isExportDialogOpen) => {
    set({ isExportDialogOpen })
  },

  setPrintTipDialogOpen: (isPrintTipDialogOpen) => {
    set({ isPrintTipDialogOpen })
  },

  setShortcutsOpen: (isShortcutsOpen) => {
    set({ isShortcutsOpen })
  },

  setExporting: (isExporting, progress = 0, statusText = '') => {
    set({ isExporting, exportProgress: progress, exportStatusText: statusText })
  },

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newToast: Toast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))

    const duration = toast.duration !== undefined ? toast.duration : 4000
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }

    return id
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }
}))
