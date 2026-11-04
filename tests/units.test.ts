import { describe, it, expect } from 'vitest'
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  mmToPt,
  ptToMm,
  mmToPx,
  pxToMm
} from '../src/renderer/engine/units'

describe('units module', () => {
  it('converts mm to pt accurately for A4', () => {
    expect(mmToPt(A4_WIDTH_MM)).toBeCloseTo(595.276, 2)
    expect(mmToPt(A4_HEIGHT_MM)).toBeCloseTo(841.890, 2)
    expect(A4_WIDTH_PT).toBeCloseTo(595.276, 2)
    expect(A4_HEIGHT_PT).toBeCloseTo(841.890, 2)
  })

  it('roundtrips mm <-> pt without loss', () => {
    const originalMm = 123.456
    const pt = mmToPt(originalMm)
    const backMm = ptToMm(pt)
    expect(backMm).toBeCloseTo(originalMm, 6)
  })

  it('converts px to mm at 300 DPI accurately', () => {
    // At 300 DPI: 1 inch = 25.4 mm = 300 px
    expect(pxToMm(300, 300)).toBeCloseTo(25.4, 4)
    expect(mmToPx(25.4, 300)).toBeCloseTo(300, 4)
  })
})
