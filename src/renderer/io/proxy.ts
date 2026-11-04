export interface ProxyResult {
  naturalW: number
  naturalH: number
  proxyUrl: string
  blob: Blob
}

/**
 * Decodes an image file or blob with EXIF auto-orientation, extracts natural dimensions,
 * and generates a proxy bitmap/blob capped at 1600px along the longest edge.
 */
export async function createProxyImage(fileOrBlob: Blob): Promise<ProxyResult> {
  // 1. Decode with EXIF auto-orientation
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(fileOrBlob, {
      imageOrientation: 'from-image'
    })
  } catch {
    // Fallback if imageOrientation isn't supported or fails
    bitmap = await createImageBitmap(fileOrBlob)
  }

  const naturalW = bitmap.width
  const naturalH = bitmap.height

  // 2. Downscale to max 1600px long edge for responsive proxy display
  const MAX_LONG_EDGE = 1600
  const maxEdge = Math.max(naturalW, naturalH)

  let proxyW = naturalW
  let proxyH = naturalH

  if (maxEdge > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / maxEdge
    proxyW = Math.round(naturalW * scale)
    proxyH = Math.round(naturalH * scale)
  }

  // 3. Render proxy using OffscreenCanvas or HTMLCanvasElement
  let proxyBlob: Blob

  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(proxyW, proxyH)
    const ctx = offscreen.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context for proxy canvas')
    ctx.drawImage(bitmap, 0, 0, proxyW, proxyH)
    proxyBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = proxyW
    canvas.height = proxyH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context for proxy canvas')
    ctx.drawImage(bitmap, 0, 0, proxyW, proxyH)
    proxyBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to convert canvas to blob'))),
        'image/jpeg',
        0.88
      )
    })
  }

  bitmap.close()

  const proxyUrl = URL.createObjectURL(proxyBlob)
  return {
    naturalW,
    naturalH,
    proxyUrl,
    blob: proxyBlob
  }
}
