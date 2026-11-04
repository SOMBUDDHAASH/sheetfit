import { Rect, LayoutNode, LeafNode, SplitNode } from '../types'

export const MIN_LEAF_SIZE_MM = 20

export interface ComputedLeaf {
  id: string
  nodeRect: Rect // node rect before gutter inset
  rect: Rect     // leaf rect after gutter inset
}

export interface ComputedDivider {
  id: string
  dir: 'cols' | 'rows'
  ratio: number
  splitNodeId: string
  // Position of divider in page coordinates
  x: number
  y: number
  w: number // thickness or extent
  h: number
  // Absolute divider line coordinate (x if cols, y if rows)
  coord: number
  // Min and max allowed coordinate along this axis given minExtents
  minCoord: number
  maxCoord: number
  // Min and max allowed ratios
  minRatio: number
  maxRatio: number
}

export interface LayoutResult {
  leaves: Map<string, ComputedLeaf>
  leafList: ComputedLeaf[]
  dividers: ComputedDivider[]
}

export function isLeaf(node: LayoutNode): node is LeafNode {
  return node.type === 'leaf'
}

export function isSplit(node: LayoutNode): node is SplitNode {
  return node.type === 'split'
}

/**
 * Calculates minimum required extent in millimeters for a node along a given axis.
 * axis: 'w' (horizontal) or 'h' (vertical)
 */
export function minExtent(node: LayoutNode, axis: 'w' | 'h'): number {
  if (isLeaf(node)) {
    return MIN_LEAF_SIZE_MM
  }

  const isAlongSplitAxis = (node.dir === 'cols' && axis === 'w') || (node.dir === 'rows' && axis === 'h')
  if (isAlongSplitAxis) {
    return minExtent(node.a, axis) + minExtent(node.b, axis)
  } else {
    return Math.max(minExtent(node.a, axis), minExtent(node.b, axis))
  }
}

/**
 * Returns the valid ratio range [minRatio, maxRatio] for a split node given parent size.
 */
export function getValidRatioRange(split: SplitNode, parentExtent: number): [number, number] {
  const axis = split.dir === 'cols' ? 'w' : 'h'
  const minA = minExtent(split.a, axis)
  const minB = minExtent(split.b, axis)

  if (parentExtent <= minA + minB) {
    // If parent is too small, split proportionally according to min constraints
    const prop = minA / (minA + minB)
    return [prop, prop]
  }

  const minRatio = minA / parentExtent
  const maxRatio = 1 - (minB / parentExtent)
  return [Math.min(minRatio, maxRatio), Math.max(minRatio, maxRatio)]
}

/**
 * Clamps ratio for a split node so neither child violates minExtent.
 */
export function clampSplitRatio(split: SplitNode, parentExtent: number, ratio: number): number {
  const [minR, maxR] = getValidRatioRange(split, parentExtent)
  if (minR >= maxR) return minR
  return Math.min(Math.max(ratio, minR), maxR)
}

/**
 * Computes all leaf and divider layout rectangles from a root node and content rectangle.
 */
export function computeLayout(
  root: LayoutNode,
  contentRect: Rect,
  gutterMm: number
): LayoutResult {
  const leaves = new Map<string, ComputedLeaf>()
  const leafList: ComputedLeaf[] = []
  const dividers: ComputedDivider[] = []

  function walk(node: LayoutNode, nodeRect: Rect) {
    if (isLeaf(node)) {
      const EPS = 0.05
      const touchesLeft = Math.abs(nodeRect.x - contentRect.x) < EPS
      const touchesRight = Math.abs((nodeRect.x + nodeRect.w) - (contentRect.x + contentRect.w)) < EPS
      const touchesTop = Math.abs(nodeRect.y - contentRect.y) < EPS
      const touchesBottom = Math.abs((nodeRect.y + nodeRect.h) - (contentRect.y + contentRect.h)) < EPS

      const halfGutter = gutterMm / 2
      const insetLeft = touchesLeft ? 0 : halfGutter
      const insetRight = touchesRight ? 0 : halfGutter
      const insetTop = touchesTop ? 0 : halfGutter
      const insetBottom = touchesBottom ? 0 : halfGutter

      const computed: ComputedLeaf = {
        id: node.id,
        nodeRect,
        rect: {
          x: nodeRect.x + insetLeft,
          y: nodeRect.y + insetTop,
          w: Math.max(0, nodeRect.w - insetLeft - insetRight),
          h: Math.max(0, nodeRect.h - insetTop - insetBottom)
        }
      }

      leaves.set(node.id, computed)
      leafList.push(computed)
      return
    }

    if (isSplit(node)) {
      const parentExtent = node.dir === 'cols' ? nodeRect.w : nodeRect.h
      const clampedRatio = clampSplitRatio(node, parentExtent, node.ratio)
      const [minRatio, maxRatio] = getValidRatioRange(node, parentExtent)

      if (node.dir === 'cols') {
        const splitW = nodeRect.w * clampedRatio
        const rectA: Rect = { x: nodeRect.x, y: nodeRect.y, w: splitW, h: nodeRect.h }
        const rectB: Rect = { x: nodeRect.x + splitW, y: nodeRect.y, w: nodeRect.w - splitW, h: nodeRect.h }
        const coord = nodeRect.x + splitW

        dividers.push({
          id: `divider-${node.id}`,
          splitNodeId: node.id,
          dir: 'cols',
          ratio: clampedRatio,
          x: coord - Math.max(gutterMm, 4) / 2,
          y: nodeRect.y,
          w: Math.max(gutterMm, 4),
          h: nodeRect.h,
          coord,
          minCoord: nodeRect.x + nodeRect.w * minRatio,
          maxCoord: nodeRect.x + nodeRect.w * maxRatio,
          minRatio,
          maxRatio
        })

        walk(node.a, rectA)
        walk(node.b, rectB)
      } else {
        const splitH = nodeRect.h * clampedRatio
        const rectA: Rect = { x: nodeRect.x, y: nodeRect.y, w: nodeRect.w, h: splitH }
        const rectB: Rect = { x: nodeRect.x, y: nodeRect.y + splitH, w: nodeRect.w, h: nodeRect.h - splitH }
        const coord = nodeRect.y + splitH

        dividers.push({
          id: `divider-${node.id}`,
          splitNodeId: node.id,
          dir: 'rows',
          ratio: clampedRatio,
          x: nodeRect.x,
          y: coord - Math.max(gutterMm, 4) / 2,
          w: nodeRect.w,
          h: Math.max(gutterMm, 4),
          coord,
          minCoord: nodeRect.y + nodeRect.h * minRatio,
          maxCoord: nodeRect.y + nodeRect.h * maxRatio,
          minRatio,
          maxRatio
        })

        walk(node.a, rectA)
        walk(node.b, rectB)
      }
    }
  }

  walk(root, contentRect)
  return { leaves, leafList, dividers }
}

/**
 * Get ordered list of leaves from tree (depth-first: a then b)
 */
export function getTreeLeaves(node: LayoutNode): LeafNode[] {
  if (isLeaf(node)) {
    return [node]
  }
  return [...getTreeLeaves(node.a), ...getTreeLeaves(node.b)]
}
