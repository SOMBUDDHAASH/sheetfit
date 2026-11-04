import { LayoutNode, SplitNode, ImageItem, Rect } from '../types'
import { isLeaf, isSplit, clampSplitRatio, getValidRatioRange, computeLayout } from './layoutTree'
import { computeDraw } from './drawRect'
import { TEMPLATES } from './templates'

/**
 * Gets effective aspect ratio of an ImageItem after crop and rotation
 */
export function getImageEffectiveAspectRatio(image?: ImageItem): number {
  if (!image) return 1.0

  let sw = image.naturalW || 1000
  let sh = image.naturalH || 1000

  if (image.edit.crop) {
    sw = Math.max(1, image.edit.crop.w * sw)
    sh = Math.max(1, image.edit.crop.h * sh)
  }

  const isRotated = image.edit.rotation === 90 || image.edit.rotation === 270
  const effW = isRotated ? sh : sw
  const effH = isRotated ? sw : sh

  return Math.max(0.1, effW / Math.max(0.1, effH))
}

/**
 * Computes area utilization (total visible image area / total content area) for a page layout in contain mode.
 */
export function computeUtilization(
  tree: LayoutNode,
  images: (ImageItem | undefined)[],
  contentRect: Rect,
  gutterMm: number
): number {
  const layout = computeLayout(tree, contentRect, gutterMm)
  let totalImgArea = 0
  const totalContentArea = Math.max(1, contentRect.w * contentRect.h)

  layout.leafList.forEach((leaf, idx) => {
    const img = images[idx]
    if (img && leaf.rect.w > 0 && leaf.rect.h > 0) {
      const draw = computeDraw(leaf.rect, img.edit, { w: img.naturalW, h: img.naturalH })
      totalImgArea += draw.destRect.w * draw.destRect.h
    }
  })

  return totalImgArea / totalContentArea
}

interface SubtreeAspect {
  aspect: number
  node: LayoutNode
}

/**
 * Equalizes split ratios so adjacent images share equal height (cols) or equal width (rows) with zero relative letterboxing.
 * "For two images side by side, the width ratio equals the aspect-ratio ratio so both have equal height and zero letterboxing."
 */
export function equalizeSplitRatios(
  root: LayoutNode,
  images: (ImageItem | undefined)[],
  contentRect: Rect
): LayoutNode {
  let imgIndex = 0

  function computeSubtree(node: LayoutNode, extentW: number, extentH: number): SubtreeAspect {
    if (isLeaf(node)) {
      const img = images[imgIndex++]
      const aspect = getImageEffectiveAspectRatio(img)
      return { aspect, node: { ...node } }
    }

    if (isSplit(node)) {
      const childA = computeSubtree(node.a, extentW, extentH)
      const childB = computeSubtree(node.b, extentW, extentH)

      let optimalRatio: number
      let combinedAspect: number

      if (node.dir === 'cols') {
        optimalRatio = childA.aspect / (childA.aspect + childB.aspect)
        combinedAspect = childA.aspect + childB.aspect
      } else {
        optimalRatio = childB.aspect / (childA.aspect + childB.aspect)
        combinedAspect = 1 / (1 / childA.aspect + 1 / childB.aspect)
      }

      const parentExtent = node.dir === 'cols' ? extentW : extentH
      const clampedRatio = clampSplitRatio(
        { ...node, a: childA.node, b: childB.node },
        parentExtent,
        optimalRatio
      )

      const updatedSplit: SplitNode = {
        ...node,
        ratio: clampedRatio,
        a: childA.node,
        b: childB.node
      }

      return { aspect: combinedAspect, node: updatedSplit }
    }

    return { aspect: 1.0, node }
  }

  return computeSubtree(root, contentRect.w, contentRect.h).node
}

function collectSplitPaths(
  node: LayoutNode,
  currentPath: number[] = []
): { path: number[]; dir: 'cols' | 'rows' }[] {
  if (isLeaf(node)) return []
  const result: { path: number[]; dir: 'cols' | 'rows' }[] = [{ path: currentPath, dir: node.dir }]
  result.push(...collectSplitPaths(node.a, [...currentPath, 0]))
  result.push(...collectSplitPaths(node.b, [...currentPath, 1]))
  return result
}

function updateNodeAtPath(root: LayoutNode, path: number[], newRatio: number): LayoutNode {
  if (path.length === 0) {
    if (isSplit(root)) {
      return { ...root, ratio: newRatio }
    }
    return root
  }
  if (!isSplit(root)) return root

  const [head, ...tail] = path
  if (head === 0) {
    return { ...root, a: updateNodeAtPath(root.a, tail, newRatio) }
  } else {
    return { ...root, b: updateNodeAtPath(root.b, tail, newRatio) }
  }
}

function getNodeParentExtent(
  root: LayoutNode,
  targetPath: number[],
  contentRect: Rect
): number {
  let curr: LayoutNode = root
  let w = contentRect.w
  let h = contentRect.h

  for (const step of targetPath) {
    if (!isSplit(curr)) break
    if (curr.dir === 'cols') {
      w = step === 0 ? w * curr.ratio : w * (1 - curr.ratio)
    } else {
      h = step === 0 ? h * curr.ratio : h * (1 - curr.ratio)
    }
    curr = step === 0 ? curr.a : curr.b
  }

  if (isSplit(curr)) {
    return curr.dir === 'cols' ? w : h
  }
  return w
}

function getNodeAtPath(root: LayoutNode, path: number[]): LayoutNode | null {
  let curr: LayoutNode = root
  for (const step of path) {
    if (!isSplit(curr)) return null
    curr = step === 0 ? curr.a : curr.b
  }
  return curr
}

/**
 * Optimizes split ratios of a given layout tree using coordinate descent to maximize total visible image area.
 * Guaranteed to produce utilization >= baseline tree.
 */
export function optimizeTreeRatios(
  root: LayoutNode,
  images: (ImageItem | undefined)[],
  contentRect: Rect,
  gutterMm: number
): LayoutNode {
  let currentTree = root
  let bestScore = computeUtilization(currentTree, images, contentRect, gutterMm)

  // Test equalized aspect ratio candidate
  const equalizedTree = equalizeSplitRatios(root, images, contentRect)
  const equalizedScore = computeUtilization(equalizedTree, images, contentRect, gutterMm)
  if (equalizedScore > bestScore) {
    bestScore = equalizedScore
    currentTree = equalizedTree
  }

  const splits = collectSplitPaths(currentTree)
  if (splits.length === 0) return currentTree

  // Coordinate descent
  const steps = 15
  for (const { path } of splits) {
    const node = getNodeAtPath(currentTree, path)
    if (!node || !isSplit(node)) continue

    const parentExtent = getNodeParentExtent(currentTree, path, contentRect)
    const [minR, maxR] = getValidRatioRange(node, parentExtent)
    if (maxR <= minR) continue

    let bestRatioForSplit = node.ratio
    for (let s = 0; s <= steps; s++) {
      const candidateRatio = minR + (s / steps) * (maxR - minR)
      const testTree = updateNodeAtPath(currentTree, path, candidateRatio)
      const score = computeUtilization(testTree, images, contentRect, gutterMm)
      if (score > bestScore) {
        bestScore = score
        bestRatioForSplit = candidateRatio
        currentTree = testTree
      }
    }

    currentTree = updateNodeAtPath(currentTree, path, bestRatioForSplit)
  }

  return currentTree
}

/**
 * Smart Pack: selects or adjusts template and split ratios to maximize visible image area.
 */
export function smartPackPage(
  images: (ImageItem | undefined)[],
  contentRect: Rect,
  gutterMm: number,
  allowTemplateChange: boolean = false,
  currentTree?: LayoutNode
): LayoutNode {
  const count = images.filter(Boolean).length
  if (count === 0) {
    return currentTree || TEMPLATES['4-grid'].build()
  }

  if (!allowTemplateChange && currentTree) {
    return optimizeTreeRatios(currentTree, images, contentRect, gutterMm)
  }

  // Candidate templates based on count
  const candidates: string[] = []
  if (count === 1) candidates.push('1')
  else if (count === 2) candidates.push('2-stacked', '2-side')
  else if (count === 3) candidates.push('3-featured', '4-grid')
  else if (count === 4) candidates.push('4-grid', '4-featured')
  else candidates.push('6-grid', '4-grid')

  let bestTree: LayoutNode = currentTree || TEMPLATES['4-grid'].build()
  let bestScore = computeUtilization(bestTree, images, contentRect, gutterMm)

  for (const candId of candidates) {
    const tmpl = TEMPLATES[candId]
    if (!tmpl) continue
    const baseTree = tmpl.build()
    const optimized = optimizeTreeRatios(baseTree, images, contentRect, gutterMm)
    const score = computeUtilization(optimized, images, contentRect, gutterMm)

    if (score > bestScore) {
      bestScore = score
      bestTree = optimized
    }
  }

  return bestTree
}
