import { describe, it, expect } from 'vitest'
import { packExactSheet, EXACT_PRESETS } from '../src/renderer/engine/exactSheet'

describe('exactSheet module', () => {
  const pageW = 210
  const pageH = 297
  const marginMm = 10
  const spacingMm = 4

  it('packs passport photos (35x45 mm) into centered grid on A4', () => {
    // Content area: 190 x 277 mm
    // Passport: 35 x 45 mm, spacing 4 mm
    // Cols: floor((190 + 4) / (35 + 4)) = floor(194 / 39) = 4
    // Rows: floor((277 + 4) / (45 + 4)) = floor(281 / 49) = 5
    // Items per page = 4 * 5 = 20
    const pages = packExactSheet({
      cellW: EXACT_PRESETS.passport.w,
      cellH: EXACT_PRESETS.passport.h,
      pageW,
      pageH,
      marginMm,
      spacingMm,
      itemCount: 20
    })

    expect(pages).toHaveLength(1)
    expect(pages[0].cells).toHaveLength(20)

    // Check that cells have exact passport dimensions
    for (const cell of pages[0].cells) {
      expect(cell.w).toBe(35)
      expect(cell.h).toBe(45)
    }

    // Check centering: grid width = 4 * 35 + 3 * 4 = 140 + 12 = 152 mm
    // Left margin should be 10 + (190 - 152) / 2 = 10 + 19 = 29 mm
    expect(pages[0].cells[0].x).toBeCloseTo(29, 2)
  })

  it('handles pagination when item count exceeds one page capacity', () => {
    // 25 passport photos -> 20 on page 1, 5 on page 2
    const pages = packExactSheet({
      cellW: 35,
      cellH: 45,
      pageW,
      pageH,
      marginMm,
      spacingMm,
      itemCount: 25
    })

    expect(pages).toHaveLength(2)
    expect(pages[0].cells).toHaveLength(20)
    expect(pages[1].cells).toHaveLength(5)
  })

  it('packs card front + back (2 stacked centered ID cards)', () => {
    const pages = packExactSheet({
      cellW: 85.6,
      cellH: 54,
      pageW,
      pageH,
      marginMm,
      spacingMm: 6,
      itemCount: 2,
      isCardFrontBack: true
    })

    expect(pages).toHaveLength(1)
    expect(pages[0].cells).toHaveLength(2)

    const [front, back] = pages[0].cells
    // Both centered horizontally: (210 - 85.6) / 2 = 62.2
    expect(front.x).toBeCloseTo(62.2, 2)
    expect(back.x).toBeCloseTo(62.2, 2)

    // Vertically stacked with 6mm spacing
    expect(back.y - (front.y + front.h)).toBeCloseTo(6, 2)
  })
})
