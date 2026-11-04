import { LayoutNode } from '../types'
import { isLeaf, isSplit } from './layoutTree'
import { leaf, split } from './templates'

/**
 * Updates a split node's ratio in a layout tree
 */
export function updateSplitRatioInTree(root: LayoutNode, splitId: string, ratio: number): LayoutNode {
  if (isLeaf(root)) return root

  if (root.id === splitId) {
    return { ...root, ratio }
  }

  return {
    ...root,
    a: updateSplitRatioInTree(root.a, splitId, ratio),
    b: updateSplitRatioInTree(root.b, splitId, ratio)
  }
}

/**
 * Splits a leaf cell either horizontally or vertically
 */
export function splitLeafInTree(root: LayoutNode, leafId: string, dir: 'cols' | 'rows'): LayoutNode {
  if (isLeaf(root)) {
    if (root.id === leafId) {
      return split(dir, 0.5, leaf(), leaf())
    }
    return root
  }

  return {
    ...root,
    a: splitLeafInTree(root.a, leafId, dir),
    b: splitLeafInTree(root.b, leafId, dir)
  }
}

/**
 * Merges a leaf cell with its sibling, replacing their parent split with the sibling
 */
export function mergeLeafInTree(root: LayoutNode, leafId: string): LayoutNode {
  if (isLeaf(root)) return root

  // Check if either direct child is the target leaf
  if (root.a.id === leafId) {
    return root.b
  }
  if (root.b.id === leafId) {
    return root.a
  }

  return {
    ...root,
    a: mergeLeafInTree(root.a, leafId),
    b: mergeLeafInTree(root.b, leafId)
  }
}

/**
 * Finds a node by id in the tree
 */
export function findNodeById(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root
  if (isSplit(root)) {
    return findNodeById(root.a, id) || findNodeById(root.b, id)
  }
  return null
}
