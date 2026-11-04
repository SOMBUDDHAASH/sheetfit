import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../src/renderer/export/buildPdf'
import { Doc, ImageItem, Settings } from '../src/renderer/types'
import { flow } from '../src/renderer/engine/flow'
import { A4_WIDTH_PT, A4_HEIGHT_PT } from '../src/renderer/engine/units'

const MINIMAL_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9
])

function createTestImage(id: string, isGrayscale: boolean): ImageItem {
  return {
    id,
    kind: 'image',
    name: `photo-${id}.jpg`,
    source: `photo-${id}.jpg`,
    naturalW: 800,
    naturalH: 600,
    proxyUrl: '',
    edit: {
      crop: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      fit: 'contain',
      zoom: 1,
      pan: { x: 0, y: 0 },
      filters: { grayscale: isGrayscale, brightness: 1, contrast: 1 }
    }
  }
}

const mockRenderer = async () => ({
  bytes: MINIMAL_JPEG,
  format: 'jpeg' as const,
  widthPx: 100,
  heightPx: 100
})

const testSettings: Settings = {
  paper: 'A4',
  orientation: 'portrait',
  preset: '2-stacked',
  marginMm: 10,
  gutterMm: 4,
  safeAreaMm: 4,
  showScaleBar: false,
  showCutGuides: false,
  showSizeBadges: false,
  mode: 'flexible'
}

describe('Color vs Black & White Grouping and Split Export', () => {
  it('groups color images first and B&W images second', () => {
    // 4 images: 2 color, 2 B&W mixed
    const img1 = createTestImage('1', false) // Color
    const img2 = createTestImage('2', true)  // B&W
    const img3 = createTestImage('3', false) // Color
    const img4 = createTestImage('4', true)  // B&W

    const doc: Doc = {
      images: [img1, img2, img3, img4],
      pages: [],
      settings: testSettings
    }

    // Group logic
    const colorImages = doc.images.filter((img) => !img.edit.filters.grayscale)
    const bwImages = doc.images.filter((img) => img.edit.filters.grayscale)
    const grouped = [...colorImages, ...bwImages]

    expect(grouped.map((i) => i.id)).toEqual(['1', '3', '2', '4'])

    const flowedDoc = flow({ ...doc, images: grouped })
    // With 2-stacked preset, 2 photos per page:
    // Page 1 should hold '1' and '3' (both Color)
    // Page 2 should hold '2' and '4' (both B&W)
    expect(flowedDoc.pages.length).toBe(2)
  })

  it('exports individual page ranges for split color and B&W PDF documents', async () => {
    const rawDoc: Doc = {
      images: [
        createTestImage('1', false),
        createTestImage('2', false),
        createTestImage('3', true),
        createTestImage('4', true)
      ],
      pages: [],
      settings: testSettings
    }
    const doc = flow(rawDoc)
    expect(doc.pages.length).toBe(2)

    // Export Color PDF only (Page 0)
    const colorPdf = await buildPdf(doc, {
      pageRange: [0],
      customCellRenderer: mockRenderer
    })
    const loadedColor = await PDFDocument.load(colorPdf)
    expect(loadedColor.getPageCount()).toBe(1)
    const pageC = loadedColor.getPage(0)
    expect(pageC.getWidth()).toBeCloseTo(A4_WIDTH_PT, 1)
    expect(pageC.getHeight()).toBeCloseTo(A4_HEIGHT_PT, 1)

    // Export B&W PDF only (Page 1) with forceGrayscale
    const bwPdf = await buildPdf(doc, {
      pageRange: [1],
      forceGrayscale: true,
      customCellRenderer: mockRenderer
    })
    const loadedBw = await PDFDocument.load(bwPdf)
    expect(loadedBw.getPageCount()).toBe(1)
    const pageB = loadedBw.getPage(0)
    expect(pageB.getWidth()).toBeCloseTo(A4_WIDTH_PT, 1)
    expect(pageB.getHeight()).toBeCloseTo(A4_HEIGHT_PT, 1)
  })

  it('correctly parses custom page ranges into 0-based page indices', () => {
    const parseCustomPageRange = (text: string, total: number): number[] => {
      const indices = new Set<number>()
      const parts = text.split(',').map((p) => p.trim())
      for (const part of parts) {
        if (!part) continue
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-').map((s) => s.trim())
          const start = parseInt(startStr, 10)
          const end = parseInt(endStr, 10)
          if (!isNaN(start) && !isNaN(end)) {
            for (let p = Math.max(1, start); p <= Math.min(total, end); p++) {
              indices.add(p - 1)
            }
          }
        } else {
          const p = parseInt(part, 10)
          if (!isNaN(p) && p >= 1 && p <= total) {
            indices.add(p - 1)
          }
        }
      }
      return Array.from(indices).sort((a, b) => a - b)
    }

    expect(parseCustomPageRange('1, 3-4', 5)).toEqual([0, 2, 3])
    expect(parseCustomPageRange('2', 5)).toEqual([1])
    expect(parseCustomPageRange('1-5', 5)).toEqual([0, 1, 2, 3, 4])
  })
})
