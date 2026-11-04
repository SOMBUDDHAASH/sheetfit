import { describe, it, expect } from 'vitest'
import {
  smartPackPage,
  optimizeTreeRatios,
  equalizeSplitRatios,
  computeUtilization,
  getImageEffectiveAspectRatio
} from '../src/renderer/engine/smartPack'
import { TEMPLATES } from '../src/renderer/engine/templates'
import { ImageItem, Rect } from '../src/renderer/types'

function makeTestImage(w: number, h: number, id: string = 'test'): ImageItem {
  return {
    id: `img-${id}-${w}x${h}`,
    kind: 'image',
    name: `test-${id}.jpg`,
    source: `test-${id}.jpg`,
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

describe('smartPack module - comprehensive cases', () => {
  const contentRect: Rect = { x: 10, y: 10, w: 190, h: 277 }
  const gutter = 4

  it('Case 1: Mixed pair (1 portrait + 1 landscape)', () => {
    // Landscape 16:9 (AR ~ 1.778) + Portrait 9:16 (AR ~ 0.5625)
    const imgLandscape = makeTestImage(1920, 1080, 'landscape')
    const imgPortrait = makeTestImage(1080, 1920, 'portrait')
    const images = [imgLandscape, imgPortrait]

    const baselineTree = TEMPLATES['2-side'].build()
    const baselineUtilization = computeUtilization(baselineTree, images, contentRect, gutter)

    const packedTree = optimizeTreeRatios(baselineTree, images, contentRect, gutter)
    const packedUtilization = computeUtilization(packedTree, images, contentRect, gutter)

    // Area optimization is guaranteed >= baseline
    expect(packedUtilization).toBeGreaterThanOrEqual(baselineUtilization)

    // Equalization rule: width ratio equals aspect ratio ratio so heights match exactly
    const equalized = equalizeSplitRatios(baselineTree, images, contentRect)
    if (equalized.type === 'split' && equalized.dir === 'cols') {
      expect(equalized.ratio).toBeGreaterThan(0.5) // Left (landscape) gets wider column than portrait
      expect(equalized.ratio).toBeCloseTo(1.7778 / (1.7778 + 0.5625), 2)
    }
  })

  it('Case 2: Two portraits (9:16 and 3:4)', () => {
    const imgPortraitA = makeTestImage(1080, 1920, 'pA') // AR = 0.5625
    const imgPortraitB = makeTestImage(1200, 1600, 'pB') // AR = 0.75
    const images = [imgPortraitA, imgPortraitB]

    const baselineTree = TEMPLATES['2-side'].build()
    const baselineUtilization = computeUtilization(baselineTree, images, contentRect, gutter)

    const packedTree = optimizeTreeRatios(baselineTree, images, contentRect, gutter)
    const packedUtilization = computeUtilization(packedTree, images, contentRect, gutter)

    expect(packedUtilization).toBeGreaterThanOrEqual(baselineUtilization)

    // Verify aspect ratios computed correctly
    expect(getImageEffectiveAspectRatio(imgPortraitA)).toBeCloseTo(1080 / 1920, 3)
    expect(getImageEffectiveAspectRatio(imgPortraitB)).toBeCloseTo(1200 / 1600, 3)

    const equalized = equalizeSplitRatios(baselineTree, images, contentRect)
    if (equalized.type === 'split' && equalized.dir === 'cols') {
      // 9:16 is narrower than 3:4, so left gets less width than right (ratio < 0.5)
      expect(equalized.ratio).toBeLessThan(0.5)
      expect(equalized.ratio).toBeCloseTo(0.5625 / (0.5625 + 0.75), 2)
    }
  })

  it('Case 3: Two landscapes (16:9 and 4:3)', () => {
    const imgLandscapeA = makeTestImage(1920, 1080, 'lA') // AR = 1.778
    const imgLandscapeB = makeTestImage(1600, 1200, 'lB') // AR = 1.333
    const images = [imgLandscapeA, imgLandscapeB]

    const baselineTree = TEMPLATES['2-side'].build()
    const baselineUtilization = computeUtilization(baselineTree, images, contentRect, gutter)

    const packedTree = optimizeTreeRatios(baselineTree, images, contentRect, gutter)
    const packedUtilization = computeUtilization(packedTree, images, contentRect, gutter)

    expect(packedUtilization).toBeGreaterThanOrEqual(baselineUtilization)

    const equalized = equalizeSplitRatios(baselineTree, images, contentRect)
    if (equalized.type === 'split' && equalized.dir === 'cols') {
      // 16:9 has larger AR than 4:3, so left gets more width (ratio > 0.5)
      expect(equalized.ratio).toBeGreaterThan(0.5)
      expect(equalized.ratio).toBeCloseTo(1.7778 / (1.7778 + 1.3333), 2)
    }
  })

  it('SmartPack template selection picks 2-stacked for two landscapes on portrait A4', () => {
    const imgA = makeTestImage(1920, 1080, 'l1')
    const imgB = makeTestImage(1600, 1200, 'l2')
    const images = [imgA, imgB]

    // Allow template change: on portrait A4, stacking 2 landscapes maximizes utilization
    const packedTree = smartPackPage(images, contentRect, gutter, true)
    if (packedTree.type === 'split') {
      expect(packedTree.dir).toBe('rows')
    }

    const utilization = computeUtilization(packedTree, images, contentRect, gutter)
    expect(utilization).toBeGreaterThan(0.4) // High page coverage
  })
})
