export const SNAP_FRACTIONS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75]
export const SNAP_DISTANCE_MM = 1.5

export interface SnapResult {
  ratio: number
  coord: number
  isSnapped: boolean
  snapType?: 'fraction' | 'aligned'
  guideCoord?: number
}

/**
 * Snaps a proposed divider position.
 * @param proposedCoord Proposed absolute mm position of divider line
 * @param parentStart Start coordinate of parent along split axis
 * @param parentExtent Total width or height of parent along split axis
 * @param minRatio Minimum allowable ratio
 * @param maxRatio Maximum allowable ratio
 * @param otherDividerCoords Absolute coordinates of other dividers in same direction
 * @param disableSnap If true (e.g. user holds Alt), skip snapping
 */
export function snapDividerPosition(
  proposedCoord: number,
  parentStart: number,
  parentExtent: number,
  minRatio: number,
  maxRatio: number,
  otherDividerCoords: number[] = [],
  disableSnap: boolean = false
): SnapResult {
  // 1. Calculate raw unclamped ratio
  const rawRatio = (proposedCoord - parentStart) / Math.max(1, parentExtent)
  const clampedRatio = Math.max(minRatio, Math.min(maxRatio, rawRatio))
  const clampedCoord = parentStart + clampedRatio * parentExtent

  if (disableSnap || parentExtent <= 0) {
    return {
      ratio: clampedRatio,
      coord: clampedCoord,
      isSnapped: false
    }
  }

  // 2. Check alignment with other dividers (within 1.5 mm)
  for (const otherCoord of otherDividerCoords) {
    if (Math.abs(proposedCoord - otherCoord) <= SNAP_DISTANCE_MM) {
      const candidateRatio = (otherCoord - parentStart) / parentExtent
      if (candidateRatio >= minRatio && candidateRatio <= maxRatio) {
        return {
          ratio: candidateRatio,
          coord: otherCoord,
          isSnapped: true,
          snapType: 'aligned',
          guideCoord: otherCoord
        }
      }
    }
  }

  // 3. Check fraction snaps (1/4, 1/3, 1/2, 2/3, 3/4)
  for (const fraction of SNAP_FRACTIONS) {
    const fractionCoord = parentStart + fraction * parentExtent
    if (Math.abs(proposedCoord - fractionCoord) <= SNAP_DISTANCE_MM) {
      if (fraction >= minRatio && fraction <= maxRatio) {
        return {
          ratio: fraction,
          coord: fractionCoord,
          isSnapped: true,
          snapType: 'fraction',
          guideCoord: fractionCoord
        }
      }
    }
  }

  return {
    ratio: clampedRatio,
    coord: clampedCoord,
    isSnapped: false
  }
}
