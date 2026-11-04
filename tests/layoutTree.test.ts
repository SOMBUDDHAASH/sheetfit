import { describe, it, expect } from 'vitest'
import {
  computeLayout,
  minExtent,
  clampSplitRatio,
  MIN_LEAF_SIZE_MM
} from '../src/renderer/engine/layoutTree'
import { TEMPLATES } from '../src/renderer/engine/templates'
import { Rect } from '../src/renderer/types'

describe('layoutTree module', () => {
  const contentRect: Rect = { x: 10, y: 10, w: 190, h: 277 }

  it('computes 1-leaf layout tiling entire content area', () => {
    const root = TEMPLATES['1'].build()
    const result = computeLayout(root, contentRect, 4)

    expect(result.leafList).toHaveLength(1)
    const leaf = result.leafList[0]
    expect(leaf.rect.x).toBe(10)
    expect(leaf.rect.y).toBe(10)
    expect(leaf.rect.w).toBe(190)
    expect(leaf.rect.h).toBe(277)
  })

  it('computes 2-column layout with exact gutter separation', () => {
    const root = TEMPLATES['2-side'].build()
    const gutter = 4
    const result = computeLayout(root, contentRect, gutter)

    expect(result.leafList).toHaveLength(2)
    const [left, right] = result.leafList

    // Left leaf touches left margin, separated from right by gutter
    expect(left.rect.x).toBe(10)
    expect(left.rect.w).toBe(190 * 0.5 - gutter / 2) // 95 - 2 = 93
    expect(left.rect.h).toBe(277)

    // Right leaf touches right margin, separated from left by gutter
    expect(right.rect.x).toBe(10 + 190 * 0.5 + gutter / 2) // 10 + 95 + 2 = 107
    expect(right.rect.w).toBe(190 * 0.5 - gutter / 2) // 93
    expect(right.rect.h).toBe(277)

    // Gap between them is exactly gutter
    const gap = right.rect.x - (left.rect.x + left.rect.w)
    expect(gap).toBeCloseTo(gutter, 4)
  })

  it('computes 4-grid layout (2x2) with 4 leaves', () => {
    const root = TEMPLATES['4-grid'].build()
    const gutter = 4
    const result = computeLayout(root, contentRect, gutter)

    expect(result.leafList).toHaveLength(4)
    expect(result.dividers).toHaveLength(3)

    // Ensure all 4 leaves have valid, positive dimensions >= MIN_LEAF_SIZE_MM
    result.leafList.forEach((leaf) => {
      expect(leaf.rect.w).toBeGreaterThanOrEqual(MIN_LEAF_SIZE_MM)
      expect(leaf.rect.h).toBeGreaterThanOrEqual(MIN_LEAF_SIZE_MM)
    })
  })

  it('calculates minExtent correctly along split and across split', () => {
    const fourGrid = TEMPLATES['4-grid'].build()
    // In 4-grid: root split is 'rows' (two child rows).
    // Child row is split 'cols' (two leaves of 20mm each -> 40mm).
    // Root minExtent along 'w': across rows split => max(colA.w, colB.w) = 40 mm.
    // Root minExtent along 'h': along rows split => minExtent(rowA) + minExtent(rowB) = 20 + 20 = 40 mm.
    expect(minExtent(fourGrid, 'w')).toBe(40)
    expect(minExtent(fourGrid, 'h')).toBe(40)
  })

  it('clamps split ratios to enforce minimum leaf sizes', () => {
    const root = TEMPLATES['2-side'].build() // split 'cols' of 2 leaves (min 20mm each)
    if (root.type === 'split') {
      const parentW = 100
      // Leaf A needs 20mm, Leaf B needs 20mm -> minRatio = 0.2, maxRatio = 0.8
      expect(clampSplitRatio(root, parentW, 0.05)).toBeCloseTo(0.2, 4)
      expect(clampSplitRatio(root, parentW, 0.95)).toBeCloseTo(0.8, 4)
      expect(clampSplitRatio(root, parentW, 0.5)).toBeCloseTo(0.5, 4)
    }
  })
})
