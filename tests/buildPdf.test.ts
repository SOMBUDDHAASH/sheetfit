import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../src/renderer/export/buildPdf'
import { Doc, ImageItem, Settings } from '../src/renderer/types'
import { flow } from '../src/renderer/engine/flow'
import { A4_WIDTH_PT, A4_HEIGHT_PT } from '../src/renderer/engine/units'

// Minimal valid 1x1 JPEG byte stream for unit testing PDF image embedding
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

function makeTestImage(id: string): ImageItem {
  return {
    id,
    kind: 'image',
    name: `test-${id}.jpg`,
    source: `test-${id}.jpg`,
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
      filters: { grayscale: false, brightness: 1, contrast: 1 }
    }
  }
}

const mockCellRenderer = async () => ({
  bytes: MINIMAL_JPEG,
  format: 'jpeg' as const,
  widthPx: 100,
  heightPx: 100
})

const defaultSettings: Settings = {
  paper: 'A4',
  orientation: 'portrait',
  preset: '4-grid',
  marginMm: 10,
  gutterMm: 4,
  safeAreaMm: 4,
  showScaleBar: true,
  showCutGuides: true,
  showSizeBadges: false,
  mode: 'flexible'
}

describe('buildPdf module', () => {
  it('exports exact A4 dimensions and MediaBox matching 210 x 297 mm in points', async () => {
    const rawDoc: Doc = {
      images: [makeTestImage('1'), makeTestImage('2')],
      pages: [],
      settings: defaultSettings
    }
    const doc = flow(rawDoc)

    const pdfBytes = await buildPdf(doc, {
      customCellRenderer: mockCellRenderer
    })

    expect(pdfBytes.length).toBeGreaterThan(0)

    const loadedDoc = await PDFDocument.load(pdfBytes)
    expect(loadedDoc.getPageCount()).toBe(1)

    const page = loadedDoc.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeCloseTo(A4_WIDTH_PT, 1)
    expect(height).toBeCloseTo(A4_HEIGHT_PT, 1)
  })

  it('exports correct page count when images span across multiple pages', async () => {
    // 5 images in 4-grid -> 2 pages
    const rawDoc: Doc = {
      images: [
        makeTestImage('1'),
        makeTestImage('2'),
        makeTestImage('3'),
        makeTestImage('4'),
        makeTestImage('5')
      ],
      pages: [],
      settings: defaultSettings
    }
    const doc = flow(rawDoc)

    const pdfBytes = await buildPdf(doc, {
      customCellRenderer: mockCellRenderer
    })

    const loadedDoc = await PDFDocument.load(pdfBytes)
    expect(loadedDoc.getPageCount()).toBe(2)
  })
})
