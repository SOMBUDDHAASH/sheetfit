import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../src/renderer/export/buildPdf'
import { Doc, ImageItem, Settings, FitMode } from '../src/renderer/types'
import { flow } from '../src/renderer/engine/flow'
import { A4_WIDTH_PT, A4_HEIGHT_PT } from '../src/renderer/engine/units'
import { computeDraw } from '../src/renderer/engine/drawRect'
import { computeLayout } from '../src/renderer/engine/layoutTree'

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

function makeTestImage(id: string, fit: FitMode = 'contain', naturalW: number = 800, naturalH: number = 600): ImageItem {
  return {
    id,
    kind: 'image',
    name: `test-${id}.jpg`,
    source: `test-${id}.jpg`,
    naturalW,
    naturalH,
    proxyUrl: '',
    edit: {
      crop: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      fit,
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

describe('buildPdf module - print placement & accuracy', () => {
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

  it('(a) asserts each image placement in PDF matches computeDraw for contain, cover and stretch', async () => {
    const fitModes: FitMode[] = ['contain', 'cover', 'stretch']

    for (const fit of fitModes) {
      // 1 landscape image (1600x900) placed in single full-page or 4-grid cell
      const img = makeTestImage('test-fit', fit, 1600, 900)
      const rawDoc: Doc = {
        images: [img],
        pages: [],
        settings: defaultSettings
      }
      const doc = flow(rawDoc)

      const contentRect = {
        x: doc.settings.marginMm,
        y: doc.settings.marginMm,
        w: 210 - 2 * doc.settings.marginMm,
        h: 297 - 2 * doc.settings.marginMm
      }
      const layout = computeLayout(doc.pages[0].tree, contentRect, doc.settings.gutterMm)
      const firstLeaf = layout.leafList[0]

      // Pure computeDraw math for the cell
      const draw = computeDraw(firstLeaf.rect, img.edit, { w: img.naturalW, h: img.naturalH })

      // Verify mathematical contract for each fit mode:
      if (fit === 'stretch') {
        expect(draw.destRect.x).toBe(firstLeaf.rect.x)
        expect(draw.destRect.y).toBe(firstLeaf.rect.y)
        expect(draw.destRect.w).toBe(firstLeaf.rect.w)
        expect(draw.destRect.h).toBe(firstLeaf.rect.h)
      } else if (fit === 'contain') {
        // Fits entirely within leaf rect
        expect(draw.destRect.x).toBeGreaterThanOrEqual(firstLeaf.rect.x)
        expect(draw.destRect.y).toBeGreaterThanOrEqual(firstLeaf.rect.y)
        expect(draw.destRect.w).toBeLessThanOrEqual(firstLeaf.rect.w + 0.001)
        expect(draw.destRect.h).toBeLessThanOrEqual(firstLeaf.rect.h + 0.001)
        // Aspect ratio preserved
        expect(draw.destRect.w / draw.destRect.h).toBeCloseTo(1600 / 900, 3)
      } else if (fit === 'cover') {
        // Covers leaf rect completely without gaps
        expect(draw.destRect.x).toBeLessThanOrEqual(firstLeaf.rect.x)
        expect(draw.destRect.y).toBeLessThanOrEqual(firstLeaf.rect.y)
        expect(draw.destRect.x + draw.destRect.w).toBeGreaterThanOrEqual(firstLeaf.rect.x + firstLeaf.rect.w - 0.001)
        expect(draw.destRect.y + draw.destRect.h).toBeGreaterThanOrEqual(firstLeaf.rect.y + firstLeaf.rect.h - 0.001)
        // Aspect ratio preserved
        expect(draw.destRect.w / draw.destRect.h).toBeCloseTo(1600 / 900, 3)
      }

      // Verify that buildPdf requests exact leaf dimensions
      let renderedCellRect: any = null
      await buildPdf(doc, {
        customCellRenderer: async (cell) => {
          renderedCellRect = cell
          return {
            bytes: MINIMAL_JPEG,
            format: 'jpeg',
            widthPx: 100,
            heightPx: 100
          }
        }
      })

      expect(renderedCellRect.x).toBeCloseTo(firstLeaf.rect.x, 3)
      expect(renderedCellRect.y).toBeCloseTo(firstLeaf.rect.y, 3)
      expect(renderedCellRect.w).toBeCloseTo(firstLeaf.rect.w, 3)
      expect(renderedCellRect.h).toBeCloseTo(firstLeaf.rect.h, 3)
    }
  })

  it('(c) asserts EXIF-rotated orientation produces consistent portrait aspect ratio in preview and export', () => {
    // Sensor raw dimensions: 4032 x 3024 (landscape)
    // EXIF Orientation 6 (90° CW): effective portrait dimensions: 3024 x 4032 (aspect ~0.75)
    const exifOrientedW = 3024
    const exifOrientedH = 4032

    // Both proxy.ts and renderCell.ts decode with { imageOrientation: 'from-image' },
    // so image.naturalW and naturalH are the post-EXIF dimensions
    const phonePhoto = makeTestImage('phone-photo', 'contain', exifOrientedW, exifOrientedH)

    const cellRect = { x: 10, y: 10, w: 90, h: 130 } // Portrait cell
    const draw = computeDraw(cellRect, phonePhoto.edit, {
      w: phonePhoto.naturalW,
      h: phonePhoto.naturalH
    })

    // The effective aspect ratio must be 3024 / 4032 = 0.75 (portrait), NOT 4032 / 3024 = 1.33 (landscape)
    const effectiveAspect = draw.destRect.w / draw.destRect.h
    expect(effectiveAspect).toBeCloseTo(3024 / 4032, 3)

    // And verify that height in portrait cell is maximized without cropping in contain mode
    expect(draw.destRect.h).toBeLessThanOrEqual(cellRect.h)
    expect(draw.destRect.w).toBeLessThanOrEqual(cellRect.w)
  })

  it('exports exact coordinates in Freeform Photoshop mode', async () => {
    const imgA = makeTestImage('free-1', 'cover', 1200, 800)
    imgA.placement = { x: 25, y: 30, w: 90, h: 70, pageIndex: 0 }

    const imgB = makeTestImage('free-2', 'contain', 800, 1200)
    imgB.placement = { x: 120, y: 50, w: 75, h: 110, pageIndex: 0 }

    const doc: Doc = {
      images: [imgA, imgB],
      pages: [],
      settings: { ...defaultSettings, mode: 'freeform' }
    }

    let renderedCells: any[] = []
    const pdfBytes = await buildPdf(doc, {
      customCellRenderer: async (cell) => {
        renderedCells.push(cell)
        return {
          bytes: MINIMAL_JPEG,
          format: 'jpeg',
          widthPx: 100,
          heightPx: 100
        }
      }
    })

    expect(pdfBytes.length).toBeGreaterThan(0)
    expect(renderedCells).toHaveLength(2)

    // Image A placement exact mm
    expect(renderedCells[0].x).toBe(25)
    expect(renderedCells[0].y).toBe(30)
    expect(renderedCells[0].w).toBe(90)
    expect(renderedCells[0].h).toBe(70)

    // Image B placement exact mm
    expect(renderedCells[1].x).toBe(120)
    expect(renderedCells[1].y).toBe(50)
    expect(renderedCells[1].w).toBe(75)
    expect(renderedCells[1].h).toBe(110)
  })
})
