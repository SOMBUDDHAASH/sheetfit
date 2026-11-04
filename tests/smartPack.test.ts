import { describe, it, expect } from 'vitest'
import { smartPackPage, computeUtilization } from '../src/renderer/engine/smartPack'
import { TEMPLATES } from '../src/renderer/engine/templates'
import { ImageItem, Rect } from '../src/renderer/types'

function makeTestImage(w: number, h: number): ImageItem {
  return {
    id: `img-${w}x${h}`,
    kind: 'image',
    name: 'test.jpg',
    source: 'test.jpg',
    naturalW: w,
    naturalH: h,
    proxyUrl: 'blob:test',
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

describe('smartPack module', () => {
  const contentRect: Rect = { x: 10, y: 10, w: 190, h: 277 }
  const gutter = 4

  it('smartPack achieves equal or higher utilization than baseline equal split for asymmetric images', () => {
    // 2 images side-by-side: one landscape 16:9, one portrait 9:16
    const imgA = makeTestImage(1600, 900) // AR = 1.777
    const imgB = makeTestImage(900, 1600) // AR = 0.5625
    const images = [imgA, imgB]

    const baselineTree = TEMPLATES['2-side'].build() // 0.5 equal split
    const baselineUtilization = computeUtilization(baselineTree, images, contentRect, gutter)

    const packedTree = smartPackPage(images, contentRect, gutter, false, baselineTree)
    const packedUtilization = computeUtilization(packedTree, images, contentRect, gutter)

    // Optimized ratios must yield greater or equal utilization
    expect(packedUtilization).toBeGreaterThanOrEqual(baselineUtilization)
  })
})
