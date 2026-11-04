import { CropRect, RotationAngle } from '../types'

export interface TransformOptions {
  rotation: RotationAngle
  flipH: boolean
  flipV: boolean
}

interface Point {
  x: number
  y: number
}

/**
 * Maps a single point from source space (0..1) to display space (0..1)
 */
export function pointSourceToDisplay(pt: Point, opt: TransformOptions): Point {
  // 1. Flip H
  let x = opt.flipH ? 1 - pt.x : pt.x
  let y = pt.y

  // 2. Flip V
  if (opt.flipV) {
    y = 1 - y
  }

  // 3. Rotate CW
  switch (opt.rotation) {
    case 0:
      return { x, y }
    case 90:
      return { x: 1 - y, y: x }
    case 180:
      return { x: 1 - x, y: 1 - y }
    case 270:
      return { x: y, y: 1 - x }
  }
}

/**
 * Maps a single point from display space (0..1) back to source space (0..1)
 */
export function pointDisplayToSource(pt: Point, opt: TransformOptions): Point {
  // Invert rotation
  let x2: number
  let y2: number
  switch (opt.rotation) {
    case 0:
      x2 = pt.x
      y2 = pt.y
      break
    case 90:
      y2 = 1 - pt.x
      x2 = pt.y
      break
    case 180:
      x2 = 1 - pt.x
      y2 = 1 - pt.y
      break
    case 270:
      y2 = pt.x
      x2 = 1 - pt.y
      break
  }

  // Invert Flip V
  const y1 = opt.flipV ? 1 - y2 : y2
  const x1 = x2

  // Invert Flip H
  const x = opt.flipH ? 1 - x1 : x1
  const y = y1

  return { x, y }
}

/**
 * Converts a normalized crop rectangle from display space (as seen by user)
 * to normalized EXIF-corrected source space (0..1).
 */
export function displayCropToSource(rect: CropRect, opt: TransformOptions): CropRect {
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h }
  ]

  const mapped = corners.map((c) => pointDisplayToSource(c, opt))
  const xs = mapped.map((c) => c.x)
  const ys = mapped.map((c) => c.y)

  const minX = Math.max(0, Math.min(...xs))
  const maxX = Math.min(1, Math.max(...xs))
  const minY = Math.max(0, Math.min(...ys))
  const maxY = Math.min(1, Math.max(...ys))

  return {
    x: minX,
    y: minY,
    w: Math.max(0.001, maxX - minX),
    h: Math.max(0.001, maxY - minY)
  }
}

/**
 * Converts a normalized crop rectangle from source space (0..1)
 * to normalized display space (0..1).
 */
export function sourceCropToDisplay(rect: CropRect, opt: TransformOptions): CropRect {
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h }
  ]

  const mapped = corners.map((c) => pointSourceToDisplay(c, opt))
  const xs = mapped.map((c) => c.x)
  const ys = mapped.map((c) => c.y)

  const minX = Math.max(0, Math.min(...xs))
  const maxX = Math.min(1, Math.max(...xs))
  const minY = Math.max(0, Math.min(...ys))
  const maxY = Math.min(1, Math.max(...ys))

  return {
    x: minX,
    y: minY,
    w: Math.max(0.001, maxX - minX),
    h: Math.max(0.001, maxY - minY)
  }
}
