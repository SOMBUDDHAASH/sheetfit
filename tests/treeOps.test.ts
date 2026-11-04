import { describe, it, expect } from 'vitest'
import {
  splitLeafInTree,
  mergeLeafInTree,
  updateSplitRatioInTree,
  findNodeById
} from '../src/renderer/engine/treeOps'
import { leaf, split } from '../src/renderer/engine/templates'
import { getTreeLeaves } from '../src/renderer/engine/layoutTree'

describe('treeOps module', () => {
  it('splits a leaf horizontally (rows) adding a new leaf', () => {
    const single = leaf()
    const result = splitLeafInTree(single, single.id, 'rows')

    expect(result.type).toBe('split')
    if (result.type === 'split') {
      expect(result.dir).toBe('rows')
      expect(result.ratio).toBe(0.5)
      expect(getTreeLeaves(result)).toHaveLength(2)
    }
  })

  it('splits a leaf vertically (cols) inside an existing split tree', () => {
    const leafA = leaf()
    const leafB = leaf()
    const tree = split('rows', 0.5, leafA, leafB)

    const result = splitLeafInTree(tree, leafA.id, 'cols')
    expect(getTreeLeaves(result)).toHaveLength(3)

    if (result.type === 'split') {
      expect(result.a.type).toBe('split')
      if (result.a.type === 'split') {
        expect(result.a.dir).toBe('cols')
      }
    }
  })

  it('merges a leaf with its sibling, promoting sibling to parent position', () => {
    const leafA = leaf()
    const leafB = leaf()
    const tree = split('cols', 0.5, leafA, leafB)

    // Merge leafA -> should leave leafB as root
    const result = mergeLeafInTree(tree, leafA.id)
    expect(result.id).toBe(leafB.id)
    expect(result.type).toBe('leaf')
  })

  it('updates split ratio in tree by splitId', () => {
    const leafA = leaf()
    const leafB = leaf()
    const tree = split('cols', 0.5, leafA, leafB)

    const updated = updateSplitRatioInTree(tree, tree.id, 0.72)
    if (updated.type === 'split') {
      expect(updated.ratio).toBe(0.72)
    }
  })

  it('finds node by id', () => {
    const leafA = leaf()
    const leafB = leaf()
    const tree = split('cols', 0.5, leafA, leafB)

    const found = findNodeById(tree, leafB.id)
    expect(found).not.toBeNull()
    expect(found?.id).toBe(leafB.id)
  })
})
