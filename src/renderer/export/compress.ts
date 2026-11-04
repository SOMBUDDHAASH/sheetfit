import { Doc } from '../types'
import { buildPdf } from './buildPdf'

export interface CompressOptions {
  targetSizeMb: number
  onProgress?: (progress: number, statusText: string) => void
  isCancelled?: () => boolean
}

/**
 * Compresses PDF export to match a target file size (in MB)
 * using binary search over JPEG quality and target DPI.
 */
export async function buildPdfWithTargetSize(
  doc: Doc,
  options: CompressOptions
): Promise<Uint8Array> {
  const targetBytes = options.targetSizeMb * 1024 * 1024

  // First trial at standard high quality (300 DPI, 0.90 quality)
  options.onProgress?.(10, 'Testing baseline high quality...')
  let pdfBytes = await buildPdf(doc, {
    targetDpi: 300,
    jpegQuality: 0.9,
    isCancelled: options.isCancelled
  })

  if (pdfBytes.length <= targetBytes) {
    return pdfBytes
  }

  // Binary search JPEG quality between 0.35 and 0.85
  let lowQuality = 0.35
  let highQuality = 0.85
  let currentDpi = 300
  let bestFitBytes = pdfBytes

  for (let step = 0; step < 4; step++) {
    if (options.isCancelled?.()) throw new Error('Export cancelled')

    const midQuality = (lowQuality + highQuality) / 2
    options.onProgress?.(
      20 + step * 15,
      `Optimizing image compression (quality ~${Math.round(midQuality * 100)}%)...`
    )

    pdfBytes = await buildPdf(doc, {
      targetDpi: currentDpi,
      jpegQuality: midQuality,
      isCancelled: options.isCancelled
    })

    if (pdfBytes.length <= targetBytes) {
      bestFitBytes = pdfBytes
      lowQuality = midQuality // Try to get higher quality if still under target
    } else {
      highQuality = midQuality
    }
  }

  // If still too large at low quality, drop DPI to 200 or 150
  if (bestFitBytes.length > targetBytes) {
    options.onProgress?.(80, 'Adjusting DPI to meet target size...')
    pdfBytes = await buildPdf(doc, {
      targetDpi: 180,
      jpegQuality: 0.65,
      isCancelled: options.isCancelled
    })
    if (pdfBytes.length < bestFitBytes.length) {
      bestFitBytes = pdfBytes
    }
  }

  return bestFitBytes
}
