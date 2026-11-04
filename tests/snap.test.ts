import { describe, it, expect } from 'vitest'
import { snapDividerPosition } from '../src/renderer/engine/snap'

describe('snap module', () => {
  const parentStart = 10
  const parentExtent = 100 // coordinates 10 to 110
  const minRatio = 0.2
  const maxRatio = 0.8

  it('snaps to 1/2 fraction when near center', () => {
    // 1/2 position is 10 + 50 = 60
    const proposed = 60.8 // within 1.5mm of 60
    const result = snapDividerPosition(proposed, parentStart, parentExtent, minRatio, maxRatio)

    expect(result.isSnapped).toBe(true)
    expect(result.ratio).toBe(0.5)
    expect(result.coord).toBe(60)
  })

  it('snaps to 1/3 fraction when near 1/3 position', () => {
    // 1/3 position is 10 + 33.333 = 43.333
    const proposed = 44.0 // within 1.5mm of 43.333
    const result = snapDividerPosition(proposed, parentStart, parentExtent, minRatio, maxRatio)

    expect(result.isSnapped).toBe(true)
    expect(result.ratio).toBeCloseTo(1 / 3, 4)
  })

  it('snaps to collinear divider within 1.5 mm', () => {
    const collinearCoords = [72.5]
    const proposed = 73.2 // within 0.7mm of collinear
    const result = snapDividerPosition(
      proposed,
      parentStart,
      parentExtent,
      minRatio,
      maxRatio,
      collinearCoords
    )

    expect(result.isSnapped).toBe(true)
    expect(result.snapType).toBe('aligned')
    expect(result.coord).toBe(72.5)
  })

  it('bypasses snapping when disableSnap is true (Alt key)', () => {
    const proposed = 60.5 // near 1/2
    const result = snapDividerPosition(
      proposed,
      parentStart,
      parentExtent,
      minRatio,
      maxRatio,
      [],
      true // disableSnap
    )

    expect(result.isSnapped).toBe(false)
    expect(result.coord).toBeCloseTo(60.5, 4)
  })

  it('clamps to min/max ratios', () => {
    const tooLow = 15 // ratio = 5/100 = 0.05 < 0.2
    const resultLow = snapDividerPosition(tooLow, parentStart, parentExtent, minRatio, maxRatio)
    expect(resultLow.ratio).toBe(0.2)
    expect(resultLow.coord).toBe(30) // 10 + 0.2 * 100 = 30

    const tooHigh = 105 // ratio = 95/100 = 0.95 > 0.8
    const resultHigh = snapDividerPosition(tooHigh, parentStart, parentExtent, minRatio, maxRatio)
    expect(resultHigh.ratio).toBe(0.8)
    expect(resultHigh.coord).toBe(90) // 10 + 0.8 * 100 = 90
  })

  it('Shift-drag collinear divider moves together when coordinates match within 0.5 mm', () => {
    // Divider A coord = 50.0, Divider B coord = 50.2 (within 0.5mm threshold)
    const coordA = 50.0
    const coordB = 50.2
    expect(Math.abs(coordA - coordB)).toBeLessThanOrEqual(0.5)

    // Proposed delta +10mm
    const deltaMm = 10
    const proposedA = coordA + deltaMm
    const proposedB = coordB + deltaMm

    const resA = snapDividerPosition(proposedA, 0, 100, 0.2, 0.8, [], true)
    const resB = snapDividerPosition(proposedB, 0, 100, 0.2, 0.8, [], true)

    expect(resA.coord).toBeCloseTo(60.0, 2)
    expect(resB.coord).toBeCloseTo(60.2, 2)
    expect(resA.ratio).toBeCloseTo(0.6, 2)
    expect(resB.ratio).toBeCloseTo(0.602, 2)
  })
})
