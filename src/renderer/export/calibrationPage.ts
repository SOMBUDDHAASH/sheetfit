import { PDFDocument, rgb } from 'pdf-lib'
import { A4_WIDTH_PT, A4_HEIGHT_PT, A4_HEIGHT_MM, mmToPt } from '../engine/units'

/**
 * Generates an exact 1-page A4 Calibration PDF containing:
 * - A 100 mm verification ruler bar
 * - A 100 mm x 100 mm square
 * - Two 50 mm x 50 mm squares
 * - Instructions for print shop verification
 */
export async function generateCalibrationPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
  page.setMediaBox(0, 0, A4_WIDTH_PT, A4_HEIGHT_PT)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkGray = rgb(0.2, 0.2, 0.2)

  // Title & Header
  page.drawText('SheetFit Print Scale & Size Calibration Page', {
    x: mmToPt(20),
    y: mmToPt(A4_HEIGHT_MM - 25),
    size: 16,
    color: black
  })

  page.drawText(
    'IMPORTANT: Print this page with "Actual Size" or "100%". Do NOT select "Fit to Page" or "Shrink to Fit".',
    {
      x: mmToPt(20),
      y: mmToPt(A4_HEIGHT_MM - 35),
      size: 9,
      color: darkGray
    }
  )

  page.drawText(
    'Use a physical ruler to measure the shapes below. If they differ by even 1 mm, the printer/software is scaling your document.',
    {
      x: mmToPt(20),
      y: mmToPt(A4_HEIGHT_MM - 42),
      size: 9,
      color: gray
    }
  )

  // 1. 100 mm Ruler Bar
  const barY_mm = A4_HEIGHT_MM - 65
  const barX_mm = 20
  const barY_pt = mmToPt(barY_mm)
  const barX_pt = mmToPt(barX_mm)
  const barLen_pt = mmToPt(100)

  page.drawLine({
    start: { x: barX_pt, y: barY_pt },
    end: { x: barX_pt + barLen_pt, y: barY_pt },
    thickness: 1,
    color: black
  })

  // Ticks every 10 mm, with taller ticks at 0, 50, 100 mm
  for (let mm = 0; mm <= 100; mm += 10) {
    const isMajor = mm === 0 || mm === 50 || mm === 100
    const tickH = mmToPt(isMajor ? 6 : 3)
    const tickX = barX_pt + mmToPt(mm)

    page.drawLine({
      start: { x: tickX, y: barY_pt },
      end: { x: tickX, y: barY_pt + tickH },
      thickness: isMajor ? 1 : 0.5,
      color: black
    })

    if (isMajor) {
      page.drawText(`${mm} mm`, {
        x: tickX - 8,
        y: barY_pt + tickH + 3,
        size: 8,
        color: black
      })
    }
  }

  page.drawText('Exact 100.0 mm Verification Bar (Must measure exactly 10 cm)', {
    x: barX_pt,
    y: barY_pt - 12,
    size: 8,
    color: darkGray
  })

  // 2. 100 mm x 100 mm Square
  const sq100Y_mm = A4_HEIGHT_MM - 95 - 100
  const sq100X_mm = 20
  page.drawRectangle({
    x: mmToPt(sq100X_mm),
    y: mmToPt(sq100Y_mm),
    width: mmToPt(100),
    height: mmToPt(100),
    borderWidth: 1,
    borderColor: black
  })

  page.drawText('100.0 x 100.0 mm Square', {
    x: mmToPt(sq100X_mm + 15),
    y: mmToPt(sq100Y_mm + 50),
    size: 11,
    color: black
  })
  page.drawText('Measure width & height with ruler (10.0 cm x 10.0 cm)', {
    x: mmToPt(sq100X_mm + 10),
    y: mmToPt(sq100Y_mm + 40),
    size: 8,
    color: gray
  })

  // 3. Two 50 mm x 50 mm Squares
  const sq50X_mm = 135
  const sq50_1_Y_mm = A4_HEIGHT_MM - 95 - 50
  const sq50_2_Y_mm = A4_HEIGHT_MM - 95 - 100

  page.drawRectangle({
    x: mmToPt(sq50X_mm),
    y: mmToPt(sq50_1_Y_mm),
    width: mmToPt(50),
    height: mmToPt(50),
    borderWidth: 1,
    borderColor: black
  })

  page.drawText('50 x 50 mm', {
    x: mmToPt(sq50X_mm + 10),
    y: mmToPt(sq50_1_Y_mm + 25),
    size: 9,
    color: black
  })

  page.drawRectangle({
    x: mmToPt(sq50X_mm),
    y: mmToPt(sq50_2_Y_mm),
    width: mmToPt(50),
    height: mmToPt(50),
    borderWidth: 1,
    borderColor: black
  })

  page.drawText('50 x 50 mm', {
    x: mmToPt(sq50X_mm + 10),
    y: mmToPt(sq50_2_Y_mm + 25),
    size: 9,
    color: black
  })

  // Bottom Footer with A4 Dimension Reference
  page.drawText('SheetFit - Designed for exact physical document reproduction on ISO 216 A4 (210 x 297 mm)', {
    x: mmToPt(20),
    y: mmToPt(15),
    size: 8,
    color: gray
  })

  return await pdfDoc.save()
}
