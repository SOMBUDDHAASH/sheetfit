import { describe, it, expect } from 'vitest'
import { flow, assignImagesToLeaves } from '../src/renderer/engine/flow'
import { Doc, ImageItem, Settings } from '../src/renderer/types'

function makeMockImage(id: string): ImageItem {
  return {
    id,
    kind: 'image',
    name: `image-${id}.jpg`,
    source: `path/to/${id}.jpg`,
    naturalW: 1920,
    naturalH: 1080,
    proxyUrl: `blob:proxy-${id}`,
    edit: {
      crop: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      fit: 'contain',
      zoom: 1,
      pan: { x: 0, y: 0 },
      filters: { grayscale: false, brightness: 1, contrast: 1 }
    }
  }
}

const defaultSettings: Settings = {
  paper: 'A4',
  orientation: 'portrait',
  preset: '4-grid',
  marginMm: 10,
  gutterMm: 4,
  safeAreaMm: 4,
  showScaleBar: false,
  showCutGuides: false,
  showSizeBadges: false,
  mode: 'flexible'
}

describe('flow module', () => {
  it('0 images: produces 0 pages (empty state)', () => {
    const doc: Doc = { images: [], pages: [], settings: defaultSettings }
    const result = flow(doc)
    expect(result.pages).toHaveLength(0)
  })

  it('1 image: produces 1 page (with 3 empty placeholders in 4-grid)', () => {
    const doc: Doc = {
      images: [makeMockImage('1')],
      pages: [],
      settings: defaultSettings
    }
    const result = flow(doc)
    expect(result.pages).toHaveLength(1)

    const assignment = assignImagesToLeaves(result.pages, result.images)
    const assignedImages = Array.from(assignment.values())
    expect(assignedImages[0]?.id).toBe('1')
    expect(assignedImages[1]).toBeUndefined()
    expect(assignedImages[2]).toBeUndefined()
    expect(assignedImages[3]).toBeUndefined()
  })

  it('4 images: produces exactly 1 page', () => {
    const doc: Doc = {
      images: [makeMockImage('1'), makeMockImage('2'), makeMockImage('3'), makeMockImage('4')],
      pages: [],
      settings: defaultSettings
    }
    const result = flow(doc)
    expect(result.pages).toHaveLength(1)

    const assignment = assignImagesToLeaves(result.pages, result.images)
    expect(Array.from(assignment.values()).filter(Boolean)).toHaveLength(4)
  })

  it('5 images: produces 2 pages', () => {
    const doc: Doc = {
      images: [
        makeMockImage('1'),
        makeMockImage('2'),
        makeMockImage('3'),
        makeMockImage('4'),
        makeMockImage('5')
      ],
      pages: [],
      settings: defaultSettings
    }
    const result = flow(doc)
    expect(result.pages).toHaveLength(2)

    const assignment = assignImagesToLeaves(result.pages, result.images)
    const nonNull = Array.from(assignment.values()).filter(Boolean)
    expect(nonNull).toHaveLength(5)
  })

  it('deleting images shrinks pages back', () => {
    // Start with 5 images across 2 pages
    const initialDoc: Doc = {
      images: [
        makeMockImage('1'),
        makeMockImage('2'),
        makeMockImage('3'),
        makeMockImage('4'),
        makeMockImage('5')
      ],
      pages: [],
      settings: defaultSettings
    }
    const flowed = flow(initialDoc)
    expect(flowed.pages).toHaveLength(2)

    // Delete 5th image -> 4 images left
    const deletedDoc: Doc = {
      ...flowed,
      images: flowed.images.slice(0, 4)
    }
    const reflowed = flow(deletedDoc)
    expect(reflowed.pages).toHaveLength(1)

    // Delete all images -> 0 pages left
    const emptyDoc: Doc = {
      ...reflowed,
      images: []
    }
    const emptyReflowed = flow(emptyDoc)
    expect(emptyReflowed.pages).toHaveLength(0)
  })
})
