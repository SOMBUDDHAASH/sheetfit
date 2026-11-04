import { Rect } from '../types'

export interface ExactPreset {
  id: string
  name: string
  w: number // mm
  h: number // mm
  description: string
  isSpecialStack?: boolean
}

export const EXACT_PRESETS: Record<string, ExactPreset> = {
  passport: {
    id: 'passport',
    name: 'Passport (35 x 45 mm)',
    w: 35,
    h: 45,
    description: 'Standard passport / visa photo'
  },
  stamp: {
    id: 'stamp',
    name: 'Stamp (20 x 25 mm)',
    w: 20,
    h: 25,
    description: 'Mini stamp size'
  },
  visa_2x2: {
    id: 'visa_2x2',
    name: 'Visa 2x2 in (51 x 51 mm)',
    w: 51,
    h: 51,
    description: 'US / International 2x2 inch visa'
  },
  photo_4x6: {
    id: 'photo_4x6',
    name: 'Photo 4x6 in (101.6 x 152.4 mm)',
    w: 101.6,
    h: 152.4,
    description: 'Standard 4x6 inch print'
  },
  photo_5x7: {
    id: 'photo_5x7',
    name: 'Photo 5x7 in (127 x 177.8 mm)',
    w: 127,
    h: 177.8,
    description: 'Standard 5x7 inch print'
  },
  id_card: {
    id: 'id_card',
    name: 'ID / Aadhaar Card (85.6 x 54 mm)',
    w: 85.6,
    h: 54,
    description: 'Standard credit / ID card size'
  },
  card_front_back: {
    id: 'card_front_back',
    name: 'Card Front + Back (Stacked)',
    w: 85.6,
    h: 54,
    description: 'Two ID cards stacked centered for printing front & back',
    isSpecialStack: true
  },
  a6: {
    id: 'a6',
    name: 'A6 (105 x 148 mm)',
    w: 105,
    h: 148,
    description: 'Quarter A4 sheet'
  }
}

export interface ExactPackOptions {
  cellW: number
  cellH: number
  pageW: number
  pageH: number
  marginMm: number
  spacingMm: number
  itemCount: number
  isCardFrontBack?: boolean
}

export interface PackedPage {
  pageIndex: number
  cells: Rect[]
}

/**
 * Computes exact physical placement of fixed-size items on pages.
 * Centers the grid on each page.
 */
export function packExactSheet(options: ExactPackOptions): PackedPage[] {
  const {
    cellW,
    cellH,
    pageW,
    pageH,
    marginMm,
    spacingMm,
    itemCount,
    isCardFrontBack
  } = options

  if (itemCount <= 0 || cellW <= 0 || cellH <= 0) return []

  const contentW = Math.max(10, pageW - 2 * marginMm)
  const contentH = Math.max(10, pageH - 2 * marginMm)

  if (isCardFrontBack) {
    // 2 stacked centered cards
    const totalH = 2 * cellH + spacingMm
    const startX = (pageW - cellW) / 2
    const startY = (pageH - totalH) / 2
    const pagesCount = Math.ceil(itemCount / 2)
    const result: PackedPage[] = []

    for (let p = 0; p < pagesCount; p++) {
      const pageCells: Rect[] = []
      const remaining = itemCount - p * 2
      if (remaining >= 1) {
        pageCells.push({ x: startX, y: startY, w: cellW, h: cellH })
      }
      if (remaining >= 2) {
        pageCells.push({ x: startX, y: startY + cellH + spacingMm, w: cellW, h: cellH })
      }
      result.push({ pageIndex: p, cells: pageCells })
    }
    return result
  }

  // Calculate cols and rows that fit into content area
  const cols = Math.max(1, Math.floor((contentW + spacingMm) / (cellW + spacingMm)))
  const rows = Math.max(1, Math.floor((contentH + spacingMm) / (cellH + spacingMm)))
  const itemsPerPage = cols * rows

  const gridW = cols * cellW + (cols - 1) * spacingMm
  const gridH = rows * cellH + (rows - 1) * spacingMm

  // Center the grid on the page
  const startX = marginMm + (contentW - gridW) / 2
  const startY = marginMm + (contentH - gridH) / 2

  const pagesCount = Math.ceil(itemCount / itemsPerPage)
  const result: PackedPage[] = []
  let placed = 0

  for (let p = 0; p < pagesCount; p++) {
    const pageCells: Rect[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (placed >= itemCount) break
        const x = startX + c * (cellW + spacingMm)
        const y = startY + r * (cellH + spacingMm)
        pageCells.push({ x, y, w: cellW, h: cellH })
        placed++
      }
      if (placed >= itemCount) break
    }
    result.push({ pageIndex: p, cells: pageCells })
  }

  return result
}
