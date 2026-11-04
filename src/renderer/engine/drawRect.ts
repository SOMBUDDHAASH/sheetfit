import { Rect, ImageEdit, DrawInstruction } from '../types'

export function computeDraw(
  cellRect: Rect,
  edit: ImageEdit,
  naturalSize: { w: number; h: number }
): DrawInstruction {
  // 1. Crop in EXIF-corrected source coordinates
  let sx = 0
  let sy = 0
  let sw = Math.max(1, naturalSize.w)
  let sh = Math.max(1, naturalSize.h)

  if (edit.crop) {
    const cx = Math.max(0, Math.min(1, edit.crop.x))
    const cy = Math.max(0, Math.min(1, edit.crop.y))
    const cw = Math.max(0.01, Math.min(1 - cx, edit.crop.w))
    const ch = Math.max(0.01, Math.min(1 - cy, edit.crop.h))

    sx = Math.round(cx * naturalSize.w)
    sy = Math.round(cy * naturalSize.h)
    sw = Math.max(1, Math.round(cw * naturalSize.w))
    sh = Math.max(1, Math.round(ch * naturalSize.h))
  }

  // 2. Visual dimensions after rotation
  const isRotated90or270 = edit.rotation === 90 || edit.rotation === 270
  const visualW = isRotated90or270 ? sh : sw
  const visualH = isRotated90or270 ? sw : sh
  const effectiveAspect = visualW / visualH
  const cellAspect = cellRect.w / Math.max(0.001, cellRect.h)

  // 3. Base dimensions according to fit mode
  let dw = cellRect.w
  let dh = cellRect.h
  let dx = cellRect.x
  let dy = cellRect.y

  if (edit.fit === 'stretch') {
    dw = cellRect.w
    dh = cellRect.h
    dx = cellRect.x
    dy = cellRect.y
  } else if (edit.fit === 'contain') {
    if (effectiveAspect >= cellAspect) {
      dw = cellRect.w
      dh = cellRect.w / effectiveAspect
      dx = cellRect.x
      dy = cellRect.y + (cellRect.h - dh) / 2
    } else {
      dh = cellRect.h
      dw = cellRect.h * effectiveAspect
      dx = cellRect.x + (cellRect.w - dw) / 2
      dy = cellRect.y
    }
  } else {
    // 'cover'
    if (effectiveAspect >= cellAspect) {
      dh = cellRect.h
      dw = cellRect.h * effectiveAspect
      dx = cellRect.x + (cellRect.w - dw) / 2
      dy = cellRect.y
    } else {
      dw = cellRect.w
      dh = cellRect.w / effectiveAspect
      dx = cellRect.x
      dy = cellRect.y + (cellRect.h - dh) / 2
    }
  }

  // 4. Zoom
  const zoom = Math.max(1, edit.zoom || 1)
  if (zoom > 1) {
    const centerDx = dx + dw / 2
    const centerDy = dy + dh / 2
    dw *= zoom
    dh *= zoom
    dx = centerDx - dw / 2
    dy = centerDy - dh / 2
  }

  // 5. Pan and clamping
  const pan = edit.pan || { x: 0, y: 0 }
  dx += pan.x * dw
  dy += pan.y * dh

  // Clamp if cover or zoomed to prevent gaps
  if (edit.fit === 'cover' || zoom > 1) {
    if (dw >= cellRect.w) {
      const minX = cellRect.x + cellRect.w - dw
      const maxX = cellRect.x
      dx = Math.min(maxX, Math.max(minX, dx))
    }
    if (dh >= cellRect.h) {
      const minY = cellRect.y + cellRect.h - dh
      const maxY = cellRect.y
      dy = Math.min(maxY, Math.max(minY, dy))
    }
  }

  return {
    sourceRect: { sx, sy, sw, sh },
    destRect: { x: dx, y: dy, w: dw, h: dh },
    rotation: edit.rotation,
    flipH: edit.flipH,
    flipV: edit.flipV,
    fit: edit.fit,
    zoom,
    pan: { x: pan.x, y: pan.y },
    filters: edit.filters || { grayscale: false, brightness: 1, contrast: 1 }
  }
}
