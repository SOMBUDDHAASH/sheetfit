import { Doc, Page, ImageItem } from '../types'
import { getTreeLeaves } from './layoutTree'
import { buildTemplate, DEFAULT_TEMPLATE_ID } from './templates'

export interface LeafAssignment {
  pageId: string
  pageIndex: number
  leafId: string
  image?: ImageItem
}

/**
 * Pure flow algorithm:
 * - Walks pages in order
 * - Each page consumes images equal to its leaf count (leaves ordered depth-first a then b)
 * - If images remain, appends pages built from current global template
 * - Deletes any page left with zero images (never deletes a page containing an image)
 * - Returns updated Doc with correct page array
 */
export function flow(doc: Doc): Doc {
  const images = doc.images
  const templateId = doc.settings.preset || DEFAULT_TEMPLATE_ID

  if (images.length === 0) {
    return {
      ...doc,
      pages: []
    }
  }

  const existingPages = doc.pages
  const newPages: Page[] = []
  let imgIndex = 0

  if (existingPages.length === 0) {
    // Start with one page
    const firstPage: Page = {
      id: `page-${Date.now().toString(36)}-1`,
      tree: buildTemplate(templateId),
      customized: false
    }
    newPages.push(firstPage)
    imgIndex += getTreeLeaves(firstPage.tree).length
  } else {
    for (const page of existingPages) {
      if (imgIndex >= images.length) {
        // This page has zero images assigned, delete it
        break
      }
      newPages.push(page)
      imgIndex += getTreeLeaves(page.tree).length
    }
  }

  // If images remain, append new pages from global template
  let pageCounter = newPages.length + 1
  while (imgIndex < images.length) {
    const newPage: Page = {
      id: `page-${Date.now().toString(36)}-${pageCounter++}`,
      tree: buildTemplate(templateId),
      customized: false
    }
    newPages.push(newPage)
    imgIndex += getTreeLeaves(newPage.tree).length
  }

  return {
    ...doc,
    pages: newPages
  }
}

/**
 * Maps each leaf in the document to its assigned ImageItem (or undefined if empty placeholder)
 */
export function assignImagesToLeaves(pages: Page[], images: ImageItem[]): Map<string, ImageItem | undefined> {
  const assignment = new Map<string, ImageItem | undefined>()
  let imgIndex = 0

  for (const page of pages) {
    const leaves = getTreeLeaves(page.tree)
    for (const leaf of leaves) {
      if (imgIndex < images.length) {
        assignment.set(leaf.id, images[imgIndex])
        imgIndex++
      } else {
        assignment.set(leaf.id, undefined)
      }
    }
  }

  return assignment
}

/**
 * Returns structured assignments with page and leaf metadata
 */
export function getLeafAssignments(pages: Page[], images: ImageItem[]): LeafAssignment[] {
  const results: LeafAssignment[] = []
  let imgIndex = 0

  pages.forEach((page, pageIndex) => {
    const leaves = getTreeLeaves(page.tree)
    leaves.forEach((leaf) => {
      const img = imgIndex < images.length ? images[imgIndex] : undefined
      results.push({
        pageId: page.id,
        pageIndex,
        leafId: leaf.id,
        image: img
      })
      if (img) imgIndex++
    })
  })

  return results
}
