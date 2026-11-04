import { Doc } from '../types'

export interface ProjectFileData {
  version: 1
  generator: 'SheetFit'
  savedAt: string
  doc: Doc
}

export async function saveProjectToFile(doc: Doc): Promise<string | null> {
  if (!window.api) return null

  const filePath = await window.api.saveFileDialog({
    title: 'Save SheetFit Project',
    defaultPath: `SheetFit-project-${new Date().toISOString().slice(0, 10)}.sheetfit`,
    filters: [{ name: 'SheetFit Project (*.sheetfit)', extensions: ['sheetfit'] }]
  })

  if (!filePath) return null

  const projectData: ProjectFileData = {
    version: 1,
    generator: 'SheetFit',
    savedAt: new Date().toISOString(),
    doc
  }

  await window.api.writeFile(filePath, JSON.stringify(projectData, null, 2))
  return filePath
}

export async function openProjectFromFile(): Promise<Doc | null> {
  if (!window.api) return null

  const filePaths = await window.api.openImagesDialog()
  if (!filePaths || filePaths.length === 0) return null

  const targetPath = filePaths[0]
  const bytes = await window.api.readFile(targetPath)
  const decoder = new TextDecoder()
  const content = decoder.decode(bytes)

  const parsed = JSON.parse(content) as ProjectFileData
  if (parsed.generator !== 'SheetFit' || !parsed.doc) {
    throw new Error('Not a valid SheetFit project file.')
  }

  return parsed.doc
}
