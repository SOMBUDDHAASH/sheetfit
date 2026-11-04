import { describe, it, expect } from 'vitest'
import {
  displayCropToSource,
  sourceCropToDisplay,
  TransformOptions
} from '../src/renderer/engine/cropMath'
import { CropRect, RotationAngle } from '../src/renderer/types'

describe('cropMath module', () => {
  const sampleCrop: CropRect = {
    x: 0.15,
    y: 0.2,
    w: 0.6,
    h: 0.5
  }

  const rotations: RotationAngle[] = [0, 90, 180, 270]
  const flipOptions = [
    { flipH: false, flipV: false },
    { flipH: true, flipV: false },
    { flipH: false, flipV: true },
    { flipH: true, flipV: true }
  ]

  it('roundtrips crop rect for all 8 flip/rotate combinations without drift', () => {
    for (const rot of rotations) {
      for (const flip of flipOptions) {
        const opt: TransformOptions = {
          rotation: rot,
          flipH: flip.flipH,
          flipV: flip.flipV
        }

        // Source -> Display -> Source
        const display = sourceCropToDisplay(sampleCrop, opt)
        const roundTripSource = displayCropToSource(display, opt)

        expect(roundTripSource.x).toBeCloseTo(sampleCrop.x, 3)
        expect(roundTripSource.y).toBeCloseTo(sampleCrop.y, 3)
        expect(roundTripSource.w).toBeCloseTo(sampleCrop.w, 3)
        expect(roundTripSource.h).toBeCloseTo(sampleCrop.h, 3)

        // Display -> Source -> Display
        const roundTripDisplay = sourceCropToDisplay(roundTripSource, opt)
        expect(roundTripDisplay.x).toBeCloseTo(display.x, 3)
        expect(roundTripDisplay.y).toBeCloseTo(display.y, 3)
        expect(roundTripDisplay.w).toBeCloseTo(display.w, 3)
        expect(roundTripDisplay.h).toBeCloseTo(display.h, 3)
      }
    }
  })
})
