export interface Rect {
  x: number // mm
  y: number // mm
  w: number // mm
  h: number // mm
}

export type SplitDir = 'cols' | 'rows'

export interface LeafNode {
  id: string
  type: 'leaf'
}

export interface SplitNode {
  id: string
  type: 'split'
  dir: SplitDir
  ratio: number // 0..1 fraction given to child a
  a: LayoutNode
  b: LayoutNode
}

export type LayoutNode = LeafNode | SplitNode

export type FitMode = 'contain' | 'cover' | 'stretch'
export type RotationAngle = 0 | 90 | 180 | 270

export interface CropRect {
  x: number // 0..1 normalized in source space
  y: number
  w: number
  h: number
}

export interface ImageFilters {
  grayscale: boolean
  brightness: number // default 1.0 (0.0 .. 2.0)
  contrast: number   // default 1.0 (0.0 .. 2.0)
}

export interface ImageEdit {
  crop: CropRect | null
  rotation: RotationAngle
  flipH: boolean
  flipV: boolean
  fit: FitMode
  zoom: number // >= 1
  pan: { x: number; y: number } // normalized offset clamped so no gap in cover
  filters: ImageFilters
}

export interface ImageItem {
  id: string
  kind: 'image' | 'blank'
  name: string
  source: string
  naturalW: number // after EXIF correction
  naturalH: number // after EXIF correction
  proxyUrl: string // max 1600px long edge
  edit: ImageEdit
}

export interface Page {
  id: string
  tree: LayoutNode
  customized: boolean
}

export interface Settings {
  paper: 'A4'
  orientation: 'portrait' | 'landscape'
  preset: string
  marginMm: number      // default 10
  gutterMm: number      // default 4
  safeAreaMm: number    // default 4 (visual guide only)
  showScaleBar: boolean
  showCutGuides: boolean
  showSizeBadges: boolean
  mode: 'flexible' | 'exact'
  exactPreset?: string
}

export interface Doc {
  images: ImageItem[]
  pages: Page[]
  settings: Settings
}

export interface PlacedLeaf {
  leafId: string
  rect: Rect // in mm
  imageItem?: ImageItem
  pageIndex: number
}

export interface DrawInstruction {
  sourceRect: { sx: number; sy: number; sw: number; sh: number }
  destRect: Rect
  rotation: RotationAngle
  flipH: boolean
  flipV: boolean
  fit: FitMode
  zoom: number
  pan: { x: number; y: number }
  filters: ImageFilters
}
