import { Rect, ImageItem } from '../types'
import { computeDraw } from '../engine/drawRect'
import { MM_PER_INCH } from '../engine/units'

export interface RenderCellResult {
  bytes: Uint8Array
  format: 'jpeg' | 'png'
  widthPx: number
  heightPx: number
}

/**
 * Renders an image within a cell at exact physical size onto an OffscreenCanvas
 * using computeDraw to guarantee preview == print.
 */
export async function renderCellToBytes(
  cellRect: Rect,
  image: ImageItem,
  targetDpi: number = 300,
  jpegQuality: number = 0.92
): Promise<RenderCellResult> {
  // 1. Calculate physical size at target DPI without upscaling beyond source resolution
  const targetPxW = Math.round((cellRect.w / MM_PER_INCH) * targetDpi)
  const targetPxH = Math.round((cellRect.h / MM_PER_INCH) * targetDpi)

  // Never upscale: clamp target resolution to natural size
  const maxNaturalEdge = Math.max(image.naturalW, image.naturalH)
  const maxTargetEdge = Math.max(targetPxW, targetPxH)
  const upscaleFactor = maxTargetEdge > maxNaturalEdge ? maxNaturalEdge / maxTargetEdge : 1.0

  const canvasW = Math.max(10, Math.round(targetPxW * upscaleFactor))
  const canvasH = Math.max(10, Math.round(targetPxH * upscaleFactor))

  const offscreen = new OffscreenCanvas(canvasW, canvasH)
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('Could not get OffscreenCanvas 2D context')

  // Fill background white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // 2. Fetch/decode source image bitmap
  let bitmap: ImageBitmap
  try {
    const response = await fetch(image.proxyUrl || image.source)
    const blob = await response.blob()
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    // If proxy failed, try fallback
    const imgElement = new Image()
    imgElement.crossOrigin = 'anonymous'
    imgElement.src = image.proxyUrl || image.source
    await new Promise((resolve, reject) => {
      imgElement.onload = resolve
      imgElement.onerror = reject
    })
    bitmap = await createImageBitmap(imgElement)
  }

  // 3. Compute exact placement using pure computeDraw in cell relative space
  const localCellRect: Rect = { x: 0, y: 0, w: cellRect.w, h: cellRect.h }
  const draw = computeDraw(localCellRect, image.edit, { w: bitmap.width, h: bitmap.height })

  // 4. Apply Filters
  const filters: string[] = []
  if (draw.filters.grayscale) filters.push('grayscale(100%)')
  if (draw.filters.brightness !== 1) filters.push(`brightness(${draw.filters.brightness})`)
  if (draw.filters.contrast !== 1) filters.push(`contrast(${draw.filters.contrast})`)
  if (filters.length > 0) {
    ctx.filter = filters.join(' ')
  }

  // 5. Transform coordinates to canvas pixels
  const pxPerMmX = canvasW / cellRect.w
  const pxPerMmY = canvasH / cellRect.h

  const dxPx = draw.destRect.x * pxPerMmX
  const dyPx = draw.destRect.y * pxPerMmY
  const dwPx = draw.destRect.w * pxPerMmX
  const dhPx = draw.destRect.h * pxPerMmY

  // 6. Draw with rotation & flip
  ctx.save()
  // Clip to cell area
  ctx.beginPath()
  ctx.rect(0, 0, canvasW, canvasH)
  ctx.clip()

  // Center of destination rect
  const centerX = dxPx + dwPx / 2
  const centerY = dyPx + dhPx / 2

  ctx.translate(centerX, centerY)

  if (draw.flipH) ctx.scale(-1, 1)
  if (draw.flipV) ctx.scale(1, -1)
  if (draw.rotation !== 0) ctx.rotate((draw.rotation * Math.PI) / 180)

  // Draw image cropped
  const isRotated90 = draw.rotation === 90 || draw.rotation === 270
  const drawW = isRotated90 ? dhPx : dwPx
  const drawH = isRotated90 ? dwPx : dhPx

  ctx.drawImage(
    bitmap,
    draw.sourceRect.sx,
    draw.sourceRect.sy,
    draw.sourceRect.sw,
    draw.sourceRect.sh,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH
  )

  ctx.restore()
  bitmap.close()

  // Convert to JPEG blob and Uint8Array
  const blob = await offscreen.convertToBlob({
    type: 'image/jpeg',
    quality: jpegQuality
  })

  const arrayBuffer = await blob.arrayBuffer()
  return {
    bytes: new Uint8Array(arrayBuffer),
    format: 'jpeg',
    widthPx: canvasW,
    heightPx: canvasH
  }
}
