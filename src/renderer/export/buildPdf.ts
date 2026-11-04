import { PDFDocument, rgb } from 'pdf-lib'
import { Doc, Page } from '../types'
import { A4_WIDTH_MM, A4_HEIGHT_MM, A4_WIDTH_PT, A4_HEIGHT_PT, mmToPt } from '../engine/units'
import { computeLayout } from '../engine/layoutTree'
import { packExactSheet, EXACT_PRESETS } from '../engine/exactSheet'
import { renderCellToBytes, RenderCellResult } from './renderCell'

export interface PdfExportOptions {
  jpegQuality?: number // 0.7 .. 1.0 (default 0.92)
  targetDpi?: number   // default 300
  showScaleBar?: boolean
  showCutGuides?: boolean
  pageRange?: 'all' | 'current' | number[]
  currentPageIndex?: number
  forceGrayscale?: boolean
  onProgress?: (progress: number, statusText: string) => void
  isCancelled?: () => boolean
  // Optional pre-rendered image renderer for Node/Vitest testing
  customCellRenderer?: (cellRect: { x: number; y: number; w: number; h: number }, img: any) => Promise<RenderCellResult>
}

/**
 * Builds an exact-size A4 PDF using pdf-lib.
 * Page size: exactly 210 x 297 mm (595.276 x 841.890 pt).
 */
export async function buildPdf(
  doc: Doc,
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  const {
    jpegQuality = 0.92,
    targetDpi = 300,
    showScaleBar = doc.settings.showScaleBar,
    showCutGuides = doc.settings.showCutGuides,
    pageRange = 'all',
    currentPageIndex = 0,
    forceGrayscale = false,
    onProgress,
    isCancelled,
    customCellRenderer
  } = options

  const pdfDoc = await PDFDocument.create()

  // Determine pages to export
  let targetPages: Page[] = []
  if (doc.settings.mode === 'freeform') {
    const maxP = Math.max(0, ...doc.images.map((i) => i.placement?.pageIndex ?? 0))
    targetPages = Array.from({ length: maxP + 1 }, (_, idx) => ({
      id: `freeform-page-${idx}`,
      tree: { id: `freeform-leaf-${idx}`, type: 'leaf' as const },
      customized: true
    }))
  } else if (doc.settings.mode === 'exact') {
    // In exact mode, pages are generated dynamically based on items and preset
    const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
    const packed = packExactSheet({
      cellW: preset.w,
      cellH: preset.h,
      pageW: A4_WIDTH_MM,
      pageH: A4_HEIGHT_MM,
      marginMm: doc.settings.marginMm,
      spacingMm: doc.settings.gutterMm,
      itemCount: doc.images.length,
      isCardFrontBack: preset.isSpecialStack
    })

    // If 0 images, export 0 pages
    if (packed.length === 0 && doc.images.length === 0) {
      return new Uint8Array()
    }

    targetPages = packed.map((_, idx) => ({
      id: `exact-page-${idx}`,
      tree: { id: `exact-leaf-${idx}`, type: 'leaf' as const },
      customized: false
    }))
  } else {
    if (pageRange === 'current') {
      targetPages = doc.pages[currentPageIndex] ? [doc.pages[currentPageIndex]] : []
    } else if (Array.isArray(pageRange)) {
      targetPages = doc.pages.filter((_, i) => pageRange.includes(i))
    } else {
      targetPages = doc.pages
    }
  }

  if (targetPages.length === 0) {
    return new Uint8Array()
  }

  const contentRect = {
    x: doc.settings.marginMm,
    y: doc.settings.marginMm,
    w: A4_WIDTH_MM - 2 * doc.settings.marginMm,
    h: A4_HEIGHT_MM - 2 * doc.settings.marginMm
  }

  // Pre-calculate image leaf assignment in flexible mode
  let globalImgIndex = 0
  const totalPages = targetPages.length

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    if (isCancelled?.()) {
      throw new Error('Export cancelled by user')
    }

    onProgress?.(
      Math.round((pIdx / totalPages) * 100),
      `Rendering page ${pIdx + 1} of ${totalPages}...`
    )

    // Add page with exact A4 dimensions
    const pdfPage = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    pdfPage.setMediaBox(0, 0, A4_WIDTH_PT, A4_HEIGHT_PT)

    if (doc.settings.mode === 'freeform') {
      const pageImages = doc.images.filter((img) => (img.placement?.pageIndex ?? 0) === pIdx)
      for (const img of pageImages) {
        if (isCancelled?.()) throw new Error('Export cancelled')
        if (img.kind === 'blank') continue

        const p = img.placement || { x: 20, y: 20, w: 80, h: 60, pageIndex: 0 }
        const renderResult = customCellRenderer
          ? await customCellRenderer(p, img)
          : await renderCellToBytes(p, img, targetDpi, jpegQuality, forceGrayscale)

        const embeddedImage =
          renderResult.format === 'png'
            ? await pdfDoc.embedPng(renderResult.bytes)
            : await pdfDoc.embedJpg(renderResult.bytes)

        const xPt = mmToPt(p.x)
        const yPt = mmToPt(A4_HEIGHT_MM - (p.y + p.h))
        const wPt = mmToPt(p.w)
        const hPt = mmToPt(p.h)

        pdfPage.drawImage(embeddedImage, {
          x: xPt,
          y: yPt,
          width: wPt,
          height: hPt
        })

        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    } else if (doc.settings.mode === 'exact') {
      const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
      const packed = packExactSheet({
        cellW: preset.w,
        cellH: preset.h,
        pageW: A4_WIDTH_MM,
        pageH: A4_HEIGHT_MM,
        marginMm: doc.settings.marginMm,
        spacingMm: doc.settings.gutterMm,
        itemCount: doc.images.length,
        isCardFrontBack: preset.isSpecialStack
      })

      const pageCells = packed[pIdx]?.cells || []
      for (let cIdx = 0; cIdx < pageCells.length; cIdx++) {
        if (isCancelled?.()) throw new Error('Export cancelled')

        const imgIdx = pIdx * pageCells.length + cIdx
        const img = doc.images[imgIdx]
        if (!img || img.kind === 'blank') continue

        const cell = pageCells[cIdx]
        const renderResult = customCellRenderer
          ? await customCellRenderer(cell, img)
          : await renderCellToBytes(cell, img, targetDpi, jpegQuality, forceGrayscale)

        const embeddedImage =
          renderResult.format === 'png'
            ? await pdfDoc.embedPng(renderResult.bytes)
            : await pdfDoc.embedJpg(renderResult.bytes)

        const xPt = mmToPt(cell.x)
        const yPt = mmToPt(A4_HEIGHT_MM - (cell.y + cell.h))
        const wPt = mmToPt(cell.w)
        const hPt = mmToPt(cell.h)

        pdfPage.drawImage(embeddedImage, {
          x: xPt,
          y: yPt,
          width: wPt,
          height: hPt
        })

        if (showCutGuides) {
          // Draw cut guides around cell
          pdfPage.drawRectangle({
            x: xPt - 0.5,
            y: yPt - 0.5,
            width: wPt + 1,
            height: hPt + 1,
            borderWidth: 0.5,
            borderColor: rgb(0.7, 0.7, 0.7),
            borderDashArray: [2, 2]
          })
        }

        // Yield to event loop
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    } else {
      // Flexible layout tree mode
      const page = targetPages[pIdx]
      const layout = computeLayout(page.tree, contentRect, doc.settings.gutterMm)

      // Draw cut guides between dividers if enabled
      if (showCutGuides) {
        layout.dividers.forEach((d) => {
          if (d.dir === 'cols') {
            const xPt = mmToPt(d.coord)
            const y1Pt = mmToPt(A4_HEIGHT_MM - (d.y + d.h))
            const y2Pt = mmToPt(A4_HEIGHT_MM - d.y)
            pdfPage.drawLine({
              start: { x: xPt, y: y1Pt },
              end: { x: xPt, y: y2Pt },
              thickness: 0.5,
              color: rgb(0.65, 0.65, 0.65),
              dashArray: [2, 2]
            })
          } else {
            const yPt = mmToPt(A4_HEIGHT_MM - d.coord)
            const x1Pt = mmToPt(d.x)
            const x2Pt = mmToPt(d.x + d.w)
            pdfPage.drawLine({
              start: { x: x1Pt, y: yPt },
              end: { x: x2Pt, y: yPt },
              thickness: 0.5,
              color: rgb(0.65, 0.65, 0.65),
              dashArray: [2, 2]
            })
          }
        })
      }

      for (const leaf of layout.leafList) {
        if (isCancelled?.()) throw new Error('Export cancelled')

        const img = globalImgIndex < doc.images.length ? doc.images[globalImgIndex] : undefined
        if (img) globalImgIndex++

        if (!img || img.kind === 'blank') continue

        const renderResult = customCellRenderer
          ? await customCellRenderer(leaf.rect, img)
          : await renderCellToBytes(leaf.rect, img, targetDpi, jpegQuality, forceGrayscale)

        const embeddedImage =
          renderResult.format === 'png'
            ? await pdfDoc.embedPng(renderResult.bytes)
            : await pdfDoc.embedJpg(renderResult.bytes)

        const xPt = mmToPt(leaf.rect.x)
        const yPt = mmToPt(A4_HEIGHT_MM - (leaf.rect.y + leaf.rect.h))
        const wPt = mmToPt(leaf.rect.w)
        const hPt = mmToPt(leaf.rect.h)

        pdfPage.drawImage(embeddedImage, {
          x: xPt,
          y: yPt,
          width: wPt,
          height: hPt
        })

        // Yield to event loop
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    // Optional 100 mm Vector Scale Bar in bottom-left corner
    if (showScaleBar) {
      const barX = mmToPt(10)
      const barY = mmToPt(6)
      const barLengthPt = mmToPt(100) // Exactly 100 mm in points
      const tickHeightPt = mmToPt(2.5)

      // Main line
      pdfPage.drawLine({
        start: { x: barX, y: barY },
        end: { x: barX + barLengthPt, y: barY },
        thickness: 0.75,
        color: rgb(0.1, 0.1, 0.1)
      })

      // Ticks at 0, 50, 100 mm
      ;[0, 50, 100].forEach((tickMm) => {
        const tickX = barX + mmToPt(tickMm)
        pdfPage.drawLine({
          start: { x: tickX, y: barY },
          end: { x: tickX, y: barY + tickHeightPt },
          thickness: 0.75,
          color: rgb(0.1, 0.1, 0.1)
        })
      })

      // Label
      pdfPage.drawText('100 mm ruler verification bar', {
        x: barX + 2,
        y: barY + tickHeightPt + 2,
        size: 7,
        color: rgb(0.2, 0.2, 0.2)
      })
    }
  }

  onProgress?.(100, 'Finalizing PDF document...')
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
