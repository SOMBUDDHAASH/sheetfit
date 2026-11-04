import React from 'react'
import { Doc } from '../types'
import { computeLayout } from '../engine/layoutTree'
import { assignImagesToLeaves } from '../engine/flow'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../engine/units'
import { packExactSheet, EXACT_PRESETS } from '../engine/exactSheet'

interface PrintContainerProps {
  doc: Doc
}

export const PrintContainer: React.FC<PrintContainerProps> = ({ doc }) => {
  const contentRect = {
    x: doc.settings.marginMm,
    y: doc.settings.marginMm,
    w: A4_WIDTH_MM - 2 * doc.settings.marginMm,
    h: A4_HEIGHT_MM - 2 * doc.settings.marginMm
  }

  const assignment = assignImagesToLeaves(doc.pages, doc.images)

  if (doc.settings.mode === 'exact') {
    const preset = EXACT_PRESETS[doc.settings.exactPreset || 'passport'] || EXACT_PRESETS.passport
    const packed = packExactSheet({
      cellW: preset.w,
      cellH: preset.h,
      pageW: A4_WIDTH_MM,
      pageH: A4_HEIGHT_MM,
      marginMm: doc.settings.marginMm,
      spacingMm: doc.settings.gutterMm,
      itemCount: doc.images.length,
      isCardFrontBack: preset.isSpecialStack
    })

    return (
      <div id="print-container">
        {packed.map((page, pIdx) => (
          <div key={pIdx} className="print-page relative bg-white">
            {page.cells.map((cell, cIdx) => {
              const imgIdx = pIdx * page.cells.length + cIdx
              const img = doc.images[imgIdx]
              if (!img || img.kind === 'blank') return null

              return (
                <div
                  key={cIdx}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${cell.x}mm`,
                    top: `${cell.y}mm`,
                    width: `${cell.w}mm`,
                    height: `${cell.h}mm`
                  }}
                >
                  <img
                    src={img.proxyUrl || img.source}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    style={{
                      transform: `rotate(${img.edit.rotation}deg) scaleX(${img.edit.flipH ? -1 : 1}) scaleY(${img.edit.flipV ? -1 : 1})`,
                      filter: `${img.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${img.edit.filters.brightness}) contrast(${img.edit.filters.contrast})`
                    }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div id="print-container">
      {doc.pages.map((page) => {
        const layout = computeLayout(page.tree, contentRect, doc.settings.gutterMm)

        return (
          <div key={page.id} className="print-page relative bg-white">
            {layout.leafList.map((leaf) => {
              const img = assignment.get(leaf.id)
              if (!img || img.kind === 'blank') return null

              return (
                <div
                  key={leaf.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${leaf.rect.x}mm`,
                    top: `${leaf.rect.y}mm`,
                    width: `${leaf.rect.w}mm`,
                    height: `${leaf.rect.h}mm`
                  }}
                >
                  <img
                    src={img.proxyUrl || img.source}
                    alt={img.name}
                    className={`w-full h-full ${img.edit.fit === 'cover' ? 'object-cover' : img.edit.fit === 'stretch' ? 'object-fill' : 'object-contain'}`}
                    style={{
                      transform: `rotate(${img.edit.rotation}deg) scaleX(${img.edit.flipH ? -1 : 1}) scaleY(${img.edit.flipV ? -1 : 1})`,
                      filter: `${img.edit.filters.grayscale ? 'grayscale(100%) ' : ''}brightness(${img.edit.filters.brightness}) contrast(${img.edit.filters.contrast})`
                    }}
                  />
                </div>
              )
            })}

            {/* Optional Scale Bar in corner */}
            {doc.settings.showScaleBar && (
              <div
                className="absolute left-[10mm] bottom-[6mm] flex flex-col"
                style={{ width: '100mm' }}
              >
                <div className="w-full h-[0.75pt] bg-black relative">
                  <div className="absolute left-0 top-0 h-[2.5mm] w-[0.75pt] bg-black" />
                  <div className="absolute left-1/2 top-0 h-[2.5mm] w-[0.75pt] bg-black" />
                  <div className="absolute right-0 top-0 h-[2.5mm] w-[0.75pt] bg-black" />
                </div>
                <span className="text-[7pt] text-neutral-800 mt-[1mm]">
                  100 mm ruler verification bar
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
