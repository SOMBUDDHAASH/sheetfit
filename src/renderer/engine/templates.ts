import { LayoutNode, LeafNode, SplitNode } from '../types'

let nextNodeId = 1
export function createLeafId(): string {
  return `leaf-${Date.now().toString(36)}-${(nextNodeId++).toString(36)}`
}

export function createSplitId(): string {
  return `split-${Date.now().toString(36)}-${(nextNodeId++).toString(36)}`
}

export function leaf(): LeafNode {
  return { id: createLeafId(), type: 'leaf' }
}

export function split(dir: 'cols' | 'rows', ratio: number, a: LayoutNode, b: LayoutNode): SplitNode {
  return {
    id: createSplitId(),
    type: 'split',
    dir,
    ratio,
    a,
    b
  }
}

export interface TemplateDefinition {
  id: string
  name: string
  cellCount: number
  description: string
  build: () => LayoutNode
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  '1': {
    id: '1',
    name: '1 Photo',
    cellCount: 1,
    description: '1 full-page photo',
    build: () => leaf()
  },
  '2-stacked': {
    id: '2-stacked',
    name: '2 Stacked',
    cellCount: 2,
    description: '2 rows (horizontal split)',
    build: () => split('rows', 0.5, leaf(), leaf())
  },
  '2-side': {
    id: '2-side',
    name: '2 Side by Side',
    cellCount: 2,
    description: '2 columns (vertical split)',
    build: () => split('cols', 0.5, leaf(), leaf())
  },
  '3-featured': {
    id: '3-featured',
    name: '3 (1 Big + 2 Small)',
    cellCount: 3,
    description: '1 large on left, 2 stacked on right',
    build: () => split('cols', 0.5, leaf(), split('rows', 0.5, leaf(), leaf()))
  },
  '4-grid': {
    id: '4-grid',
    name: '4 Grid (2x2)',
    cellCount: 4,
    description: '2x2 grid (default)',
    build: () =>
      split(
        'rows',
        0.5,
        split('cols', 0.5, leaf(), leaf()),
        split('cols', 0.5, leaf(), leaf())
      )
  },
  '4-featured': {
    id: '4-featured',
    name: '4 (1 Big + 3 Small)',
    cellCount: 4,
    description: '1 large on left, 3 stacked on right',
    build: () =>
      split(
        'cols',
        0.5,
        leaf(),
        split('rows', 1 / 3, leaf(), split('rows', 0.5, leaf(), leaf()))
      )
  },
  '6-grid': {
    id: '6-grid',
    name: '6 Grid (2x3)',
    cellCount: 6,
    description: '2 columns x 3 rows with equal cells',
    build: () =>
      split(
        'cols',
        0.5,
        split('rows', 1 / 3, leaf(), split('rows', 0.5, leaf(), leaf())),
        split('rows', 1 / 3, leaf(), split('rows', 0.5, leaf(), leaf()))
      )
  }
}

export const DEFAULT_TEMPLATE_ID = '4-grid'

export const QUICK_TEMPLATES: { key: '1' | '2' | '4' | '6'; templateId: string; label: string }[] = [
  { key: '1', templateId: '1', label: '1' },
  { key: '2', templateId: '2-side', label: '2' },
  { key: '4', templateId: '4-grid', label: '4' },
  { key: '6', templateId: '6-grid', label: '6' }
]

export function buildTemplate(templateId: string): LayoutNode {
  const t = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE_ID]
  return t.build()
}
