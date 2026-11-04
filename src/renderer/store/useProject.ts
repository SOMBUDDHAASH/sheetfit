import { create } from 'zustand'
import { temporal } from 'zundo'
import { immer } from 'zustand/middleware/immer'
import { Doc, ImageItem, ImageEdit, Settings, LayoutNode } from '../types'
import { flow } from '../engine/flow'
import { buildTemplate, DEFAULT_TEMPLATE_ID } from '../engine/templates'
import { updateSplitRatioInTree, splitLeafInTree, mergeLeafInTree } from '../engine/treeOps'
import { smartPackPage } from '../engine/smartPack'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../engine/units'

export interface ProjectState {
  doc: Doc
  // Actions
  addImages: (newImages: ImageItem[]) => void
  removeImage: (id: string) => void
  reorderImages: (activeId: string, overId: string) => void
  setGlobalTemplate: (templateId: string) => void
  setPageTemplate: (pageId: string, templateId: string) => void
  setPageTree: (pageId: string, tree: LayoutNode) => void
  updateSplitRatio: (pageId: string, splitId: string, ratio: number) => void
  updateSplitRatios: (pageId: string, updates: { splitId: string; ratio: number }[]) => void
  splitCell: (pageId: string, leafId: string, dir: 'cols' | 'rows') => void
  mergeCell: (pageId: string, leafId: string) => void
  insertBlankCell: (afterId?: string) => void
  swapImages: (idA: string, idB: string) => void
  updateImageEdit: (id: string, partialEdit: Partial<ImageEdit>) => void
  batchUpdateImageEdits: (ids: string[], partialEdit: Partial<ImageEdit>) => void
  updateSettings: (partialSettings: Partial<Settings>) => void
  clearAll: () => void
  loadDoc: (newDoc: Doc) => void
  smartPackCurrentPage: (pageId: string) => void
  smartPackAllPages: () => void
}

const initialSettings: Settings = {
  paper: 'A4',
  orientation: 'portrait',
  preset: DEFAULT_TEMPLATE_ID,
  marginMm: 10,
  gutterMm: 4,
  safeAreaMm: 4,
  showScaleBar: false,
  showCutGuides: false,
  showSizeBadges: false,
  mode: 'flexible'
}

const initialDoc: Doc = {
  images: [],
  pages: [],
  settings: initialSettings
}

export const useProject = create<ProjectState>()(
  temporal(
    immer((set) => ({
      doc: initialDoc,

      addImages: (newImages) => {
        set((state) => {
          state.doc.images.push(...newImages)
          state.doc = flow(state.doc)
        })
      },

      removeImage: (id) => {
        set((state) => {
          state.doc.images = state.doc.images.filter((img) => img.id !== id)
          state.doc = flow(state.doc)
        })
      },

      reorderImages: (activeId, overId) => {
        set((state) => {
          const oldIndex = state.doc.images.findIndex((img) => img.id === activeId)
          const newIndex = state.doc.images.findIndex((img) => img.id === overId)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const [moved] = state.doc.images.splice(oldIndex, 1)
            state.doc.images.splice(newIndex, 0, moved)
            state.doc = flow(state.doc)
          }
        })
      },

      setGlobalTemplate: (templateId) => {
        set((state) => {
          state.doc.settings.preset = templateId
          // Rebuild all page trees with new global template unless customized
          state.doc.pages = state.doc.pages.map((p) => ({
            ...p,
            tree: buildTemplate(templateId),
            customized: false
          }))
          state.doc = flow(state.doc)
        })
      },

      setPageTemplate: (pageId, templateId) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            page.tree = buildTemplate(templateId)
            page.customized = true
            state.doc = flow(state.doc)
          }
        })
      },

      setPageTree: (pageId, tree) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            page.tree = tree
            page.customized = true
            state.doc = flow(state.doc)
          }
        })
      },

      updateSplitRatio: (pageId, splitId, ratio) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            page.tree = updateSplitRatioInTree(page.tree, splitId, ratio)
            page.customized = true
          }
        })
      },

      updateSplitRatios: (pageId, updates) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            let tree = page.tree
            for (const u of updates) {
              tree = updateSplitRatioInTree(tree, u.splitId, u.ratio)
            }
            page.tree = tree
            page.customized = true
          }
        })
      },

      splitCell: (pageId, leafId, dir) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            page.tree = splitLeafInTree(page.tree, leafId, dir)
            page.customized = true
            state.doc = flow(state.doc)
          }
        })
      },

      mergeCell: (pageId, leafId) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (page) {
            page.tree = mergeLeafInTree(page.tree, leafId)
            page.customized = true
            state.doc = flow(state.doc)
          }
        })
      },

      insertBlankCell: (afterId) => {
        set((state) => {
          const blankItem: ImageItem = {
            id: `blank-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind: 'blank',
            name: 'Blank Space',
            source: '',
            naturalW: 1000,
            naturalH: 1000,
            proxyUrl: '',
            edit: {
              crop: null,
              rotation: 0,
              flipH: false,
              flipV: false,
              fit: 'contain',
              zoom: 1,
              pan: { x: 0, y: 0 },
              filters: { grayscale: false, brightness: 1, contrast: 1 }
            }
          }

          if (afterId) {
            const idx = state.doc.images.findIndex((img) => img.id === afterId)
            if (idx !== -1) {
              state.doc.images.splice(idx + 1, 0, blankItem)
            } else {
              state.doc.images.push(blankItem)
            }
          } else {
            state.doc.images.push(blankItem)
          }
          state.doc = flow(state.doc)
        })
      },

      swapImages: (idA, idB) => {
        set((state) => {
          const idxA = state.doc.images.findIndex((img) => img.id === idA)
          const idxB = state.doc.images.findIndex((img) => img.id === idB)
          if (idxA !== -1 && idxB !== -1) {
            const temp = state.doc.images[idxA]
            state.doc.images[idxA] = state.doc.images[idxB]
            state.doc.images[idxB] = temp
            state.doc = flow(state.doc)
          }
        })
      },

      updateImageEdit: (id, partialEdit) => {
        set((state) => {
          const img = state.doc.images.find((i) => i.id === id)
          if (img) {
            img.edit = {
              ...img.edit,
              ...partialEdit,
              filters: {
                ...img.edit.filters,
                ...(partialEdit.filters || {})
              }
            }
          }
        })
      },

      batchUpdateImageEdits: (ids, partialEdit) => {
        set((state) => {
          state.doc.images.forEach((img) => {
            if (ids.includes(img.id)) {
              img.edit = {
                ...img.edit,
                ...partialEdit,
                filters: {
                  ...img.edit.filters,
                  ...(partialEdit.filters || {})
                }
              }
            }
          })
        })
      },

      updateSettings: (partialSettings) => {
        set((state) => {
          state.doc.settings = { ...state.doc.settings, ...partialSettings }
          state.doc = flow(state.doc)
        })
      },

      clearAll: () => {
        set((state) => {
          state.doc = {
            ...state.doc,
            images: [],
            pages: []
          }
        })
      },

      loadDoc: (newDoc) => {
        set((state) => {
          state.doc = flow(newDoc)
        })
      },

      smartPackCurrentPage: (pageId) => {
        set((state) => {
          const page = state.doc.pages.find((p) => p.id === pageId)
          if (!page) return
          const pageIdx = state.doc.pages.indexOf(page)
          const contentRect = {
            x: state.doc.settings.marginMm,
            y: state.doc.settings.marginMm,
            w: A4_WIDTH_MM - 2 * state.doc.settings.marginMm,
            h: A4_HEIGHT_MM - 2 * state.doc.settings.marginMm
          }
          const imagesForPage = state.doc.images.slice(pageIdx * 4, (pageIdx + 1) * 4) // approximation or leaf count
          page.tree = smartPackPage(
            imagesForPage,
            contentRect,
            state.doc.settings.gutterMm,
            false,
            page.tree
          )
          page.customized = true
          state.doc = flow(state.doc)
        })
      },

      smartPackAllPages: () => {
        set((state) => {
          const contentRect = {
            x: state.doc.settings.marginMm,
            y: state.doc.settings.marginMm,
            w: A4_WIDTH_MM - 2 * state.doc.settings.marginMm,
            h: A4_HEIGHT_MM - 2 * state.doc.settings.marginMm
          }
          let imgOffset = 0
          state.doc.pages.forEach((page) => {
            const leaves = page.tree
            const imagesForPage = state.doc.images.slice(imgOffset, imgOffset + 6)
            page.tree = smartPackPage(
              imagesForPage,
              contentRect,
              state.doc.settings.gutterMm,
              false,
              leaves
            )
            page.customized = true
            imgOffset += 4
          })
          state.doc = flow(state.doc)
        })
      }
    })),
    {
      limit: 100
    }
  )
)
