import { MM_PER_INCH } from './units'

export type DpiLevel = 'low' | 'medium' | 'good'

export interface DpiCalculation {
  dpi: number
  level: DpiLevel
  warning?: string
}

/**
 * Calculates effective placed DPI given source pixel dimensions and placed mm dimensions
 */
export function calculateEffectiveDpi(
  sourcePixelW: number,
  sourcePixelH: number,
  placedMmW: number,
  placedMmH: number
): DpiCalculation {
  if (placedMmW <= 0 || placedMmH <= 0 || sourcePixelW <= 0 || sourcePixelH <= 0) {
    return { dpi: 0, level: 'low', warning: 'Invalid dimensions' }
  }

  const placedInchesW = placedMmW / MM_PER_INCH
  const placedInchesH = placedMmH / MM_PER_INCH

  const dpiW = sourcePixelW / placedInchesW
  const dpiH = sourcePixelH / placedInchesH

  const dpi = Math.round(Math.min(dpiW, dpiH))

  if (dpi < 150) {
    return {
      dpi,
      level: 'low',
      warning: 'May print blurry at this size (<150 DPI)'
    }
  }

  if (dpi < 250) {
    return {
      dpi,
      level: 'medium',
      warning: 'Moderate quality (150-250 DPI)'
    }
  }

  return {
    dpi,
    level: 'good'
  }
}
