import type { Snippet, RaycastSnippet } from '@/types'

interface FilePickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}

interface FileSystemFileHandle {
  name: string
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>
  }
}

export function snippetsToRaycastJson(snippets: Snippet[]): RaycastSnippet[] {
  return snippets.map((s) => {
    const raycast: RaycastSnippet = {
      name: s.name,
      text: s.text,
    }
    if (s.keyword) {
      raycast.keyword = s.keyword
    }
    return raycast
  })
}

export async function exportSnippets(snippets: Snippet[]): Promise<string> {
  const raycastSnippets = snippetsToRaycastJson(snippets)
  const json = JSON.stringify(raycastSnippets, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const defaultFilename = 'raycast-snippets.json'

  // Try File System Access API (modern browsers)
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'JSON files',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return handle.name
    } catch (err) {
      // User cancelled - check for abort error
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }
      // Fall through to download fallback for other errors
    }
  }

  // Fallback: trigger download to Downloads folder
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return `~/Downloads/${defaultFilename}`
}
