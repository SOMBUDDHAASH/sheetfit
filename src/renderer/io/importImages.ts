import { ImageItem } from '../types'
import { createProxyImage } from './proxy'

export const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']

export interface ImportProgress {
  total: number
  completed: number
  failed: number
  currentFileName?: string
}

export interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void
  onError?: (fileName: string, error: Error) => void
  onRejected?: (rejectedFileNames: string[]) => void
}

/**
 * Checks whether a filename or mime type is supported.
 */
export function isSupportedImageFile(fileOrName: File | string): boolean {
  if (typeof fileOrName === 'string') {
    const ext = fileOrName.toLowerCase().split('.').pop() || ''
    return SUPPORTED_EXTENSIONS.includes(ext)
  }

  if (fileOrName.type && fileOrName.type.startsWith('image/')) {
    const sub = fileOrName.type.replace('image/', '').toLowerCase()
    if (SUPPORTED_EXTENSIONS.includes(sub) || sub === 'x-ms-bmp') return true
  }

  const ext = fileOrName.name.toLowerCase().split('.').pop() || ''
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * Concurrency worker: executes tasks with max 4 in flight at once
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      results[idx] = await fn(items[idx], idx)
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * Imports images from File objects (e.g. from Drag & Drop or file input).
 */
export async function importFromFiles(
  files: File[],
  options?: ImportOptions
): Promise<ImageItem[]> {
  const validFiles: File[] = []
  const rejectedNames: string[] = []

  for (const file of files) {
    if (isSupportedImageFile(file)) {
      validFiles.push(file)
    } else {
      rejectedNames.push(file.name)
    }
  }

  if (rejectedNames.length > 0 && options?.onRejected) {
    options.onRejected(rejectedNames)
  }

  const total = validFiles.length
  let completed = 0
  let failed = 0

  const items = await runWithConcurrency(validFiles, 4, async (file) => {
    try {
      options?.onProgress?.({
        total,
        completed,
        failed,
        currentFileName: file.name
      })

      const proxy = await createProxyImage(file)
      const filePath = window.api?.getPathForFile?.(file) || file.name

      const item: ImageItem = {
        id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'image',
        name: file.name,
        source: filePath,
        naturalW: proxy.naturalW,
        naturalH: proxy.naturalH,
        proxyUrl: proxy.proxyUrl,
        edit: {
          crop: null,
          rotation: 0,
          flipH: false,
          flipV: false,
          fit: 'contain',
          zoom: 1,
          pan: { x: 0, y: 0 },
          filters: { grayscale: false, brightness: 1, contrast: 1 }
        }
      }

      completed++
      options?.onProgress?.({ total, completed, failed, currentFileName: file.name })
      return item
    } catch (err) {
      failed++
      const error = err instanceof Error ? err : new Error(String(err))
      options?.onError?.(file.name, error)
      return null
    }
  })

  return items.filter((item): item is ImageItem => item !== null)
}

/**
 * Imports images from absolute file paths (via electron IPC open dialog or CLI args).
 */
export async function importFromFilePaths(
  filePaths: string[],
  options?: ImportOptions
): Promise<ImageItem[]> {
  const validPaths: string[] = []
  const rejectedNames: string[] = []

  for (const p of filePaths) {
    if (isSupportedImageFile(p)) {
      validPaths.push(p)
    } else {
      rejectedNames.push(p)
    }
  }

  if (rejectedNames.length > 0 && options?.onRejected) {
    options.onRejected(rejectedNames)
  }

  const total = validPaths.length
  let completed = 0
  let failed = 0

  const items = await runWithConcurrency(validPaths, 4, async (filePath) => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    try {
      options?.onProgress?.({
        total,
        completed,
        failed,
        currentFileName: fileName
      })

      if (!window.api) throw new Error('Electron API not available')
      const bytes = await window.api.readFile(filePath)
      const ext = fileName.toLowerCase().split('.').pop() || 'jpeg'
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const blob = new Blob([bytes as unknown as BlobPart], { type: mime })

      const proxy = await createProxyImage(blob)

      const item: ImageItem = {
        id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'image',
        name: fileName,
        source: filePath,
        naturalW: proxy.naturalW,
        naturalH: proxy.naturalH,
        proxyUrl: proxy.proxyUrl,
        edit: {
          crop: null,
          rotation: 0,
          flipH: false,
          flipV: false,
          fit: 'contain',
          zoom: 1,
          pan: { x: 0, y: 0 },
          filters: { grayscale: false, brightness: 1, contrast: 1 }
        }
      }

      completed++
      options?.onProgress?.({ total, completed, failed, currentFileName: fileName })
      return item
    } catch (err) {
      failed++
      const error = err instanceof Error ? err : new Error(String(err))
      options?.onError?.(fileName, error)
      return null
    }
  })

  return items.filter((item): item is ImageItem => item !== null)
}
