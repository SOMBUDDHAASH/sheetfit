import { LayoutNode, ImageItem, Rect } from '../types'
import { isLeaf, isSplit, getValidRatioRange, computeLayout } from './layoutTree'
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

/**
 * Collects references to all split nodes in the tree
 */
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
 */
export function optimizeTreeRatios(
  root: LayoutNode,
  images: (ImageItem | undefined)[],
  contentRect: Rect,
  gutterMm: number
): LayoutNode {
  let currentTree = root
  let bestScore = computeUtilization(currentTree, images, contentRect, gutterMm)

  // Initial seed from aspect ratios if 2-leaf split
  if (isSplit(currentTree) && isLeaf(currentTree.a) && isLeaf(currentTree.b)) {
    const arA = getImageEffectiveAspectRatio(images[0])
    const arB = getImageEffectiveAspectRatio(images[1])
    let seedRatio: number
    if (currentTree.dir === 'cols') {
      seedRatio = arA / (arA + arB)
    } else {
      seedRatio = arB / (arA + arB)
    }

    const parentExt = currentTree.dir === 'cols' ? contentRect.w : contentRect.h
    const [minR, maxR] = getValidRatioRange(currentTree, parentExt)
    const clampedSeed = Math.max(minR, Math.min(maxR, seedRatio))
    const candidateTree: LayoutNode = { ...currentTree, ratio: clampedSeed }
    const candScore = computeUtilization(candidateTree, images, contentRect, gutterMm)
    if (candScore > bestScore) {
      bestScore = candScore
      currentTree = candidateTree
    }
  }

  const splits = collectSplitPaths(currentTree)
  if (splits.length === 0) return currentTree

  // Run 2 iterations of coordinate descent over all splits
  const maxIterations = 2
  const steps = 20

  for (let iter = 0; iter < maxIterations; iter++) {
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
  else if (count === 2) candidates.push('2-side', '2-stacked')
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
