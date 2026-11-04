export const MM_PER_INCH = 25.4
export const POINTS_PER_INCH = 72
export const PT_PER_MM = POINTS_PER_INCH / MM_PER_INCH // ~2.834645669291339

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

export const A4_WIDTH_PT = A4_WIDTH_MM * PT_PER_MM // 595.275590551181
export const A4_HEIGHT_PT = A4_HEIGHT_MM * PT_PER_MM // 841.8897637795276

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM
}

export function mmToPx(mm: number, dpi: number = 96): number {
  return (mm / MM_PER_INCH) * dpi
}

export function pxToMm(px: number, dpi: number = 96): number {
  return (px / dpi) * MM_PER_INCH
}

export function roundPrecision(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(val * factor) / factor
}
