import { describe, it, expect } from 'vitest'
import { computeDraw } from '../src/renderer/engine/drawRect'
import { Rect, ImageEdit, FitMode, RotationAngle } from '../src/renderer/types'

describe('drawRect module', () => {
  const cellRect: Rect = { x: 10, y: 10, w: 100, h: 100 }
  const naturalSize = { w: 800, h: 400 } // aspect ratio 2:1

  const fitModes: FitMode[] = ['contain', 'cover', 'stretch']
  const rotations: RotationAngle[] = [0, 90, 180, 270]
  const flips = [
    { flipH: false, flipV: false },
    { flipH: true, flipV: false },
    { flipH: false, flipV: true },
    { flipH: true, flipV: true }
  ]

  it('runs across all 8 orientations x 3 fit modes with valid coordinates', () => {
    for (const fit of fitModes) {
      for (const rot of rotations) {
        for (const flip of flips) {
          const edit: ImageEdit = {
            crop: null,
            rotation: rot,
            flipH: flip.flipH,
            flipV: flip.flipV,
            fit,
            zoom: 1,
            pan: { x: 0, y: 0 },
            filters: { grayscale: false, brightness: 1, contrast: 1 }
          }

          const draw = computeDraw(cellRect, edit, naturalSize)

          // Dest rect dimensions must be positive
          expect(draw.destRect.w).toBeGreaterThan(0)
          expect(draw.destRect.h).toBeGreaterThan(0)
          expect(Number.isFinite(draw.destRect.x)).toBe(true)
          expect(Number.isFinite(draw.destRect.y)).toBe(true)

          // Source rect must match natural size when crop is null
          expect(draw.sourceRect.sx).toBe(0)
          expect(draw.sourceRect.sy).toBe(0)
          expect(draw.sourceRect.sw).toBe(800)
          expect(draw.sourceRect.sh).toBe(400)

          if (fit === 'stretch') {
            expect(draw.destRect.w).toBe(cellRect.w)
            expect(draw.destRect.h).toBe(cellRect.h)
            expect(draw.destRect.x).toBe(cellRect.x)
            expect(draw.destRect.y).toBe(cellRect.y)
          } else if (fit === 'contain') {
            // Must fit inside cell without overflowing
            expect(draw.destRect.w).toBeLessThanOrEqual(cellRect.w + 0.001)
            expect(draw.destRect.h).toBeLessThanOrEqual(cellRect.h + 0.001)
          } else if (fit === 'cover') {
            // Must cover cell without gaps
            expect(draw.destRect.w).toBeGreaterThanOrEqual(cellRect.w - 0.001)
            expect(draw.destRect.h).toBeGreaterThanOrEqual(cellRect.h - 0.001)
          }
        }
      }
    }
  })

  it('correctly handles crop coordinates', () => {
    const edit: ImageEdit = {
      crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      rotation: 0,
      flipH: false,
      flipV: false,
      fit: 'contain',
      zoom: 1,
      pan: { x: 0, y: 0 },
      filters: { grayscale: false, brightness: 1, contrast: 1 }
    }

    const draw = computeDraw(cellRect, edit, naturalSize)
    expect(draw.sourceRect.sx).toBe(200) // 0.25 * 800
    expect(draw.sourceRect.sy).toBe(100) // 0.25 * 400
    expect(draw.sourceRect.sw).toBe(400) // 0.5 * 800
    expect(draw.sourceRect.sh).toBe(200) // 0.5 * 400
  })

  it('clamps pan in cover mode to prevent empty gaps', () => {
    const edit: ImageEdit = {
      crop: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      fit: 'cover',
      zoom: 1,
      pan: { x: 0.8, y: 0.8 }, // excessive pan
      filters: { grayscale: false, brightness: 1, contrast: 1 }
    }

    const draw = computeDraw(cellRect, edit, naturalSize)
    // In cover mode, the image must completely cover cellRect:
    // left edge <= cellRect.x, right edge >= cellRect.x + cellRect.w
    expect(draw.destRect.x).toBeLessThanOrEqual(cellRect.x)
    expect(draw.destRect.x + draw.destRect.w).toBeGreaterThanOrEqual(cellRect.x + cellRect.w)
    // top edge <= cellRect.y, bottom edge >= cellRect.y + cellRect.h
    expect(draw.destRect.y).toBeLessThanOrEqual(cellRect.y)
    expect(draw.destRect.y + draw.destRect.h).toBeGreaterThanOrEqual(cellRect.y + cellRect.h)
  })
})
