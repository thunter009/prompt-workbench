import type { Snippet, RaycastSnippet } from '@/types'
import { resolveSnippetIncludes, type ResolutionError } from '@/lib/raycast/snippet-resolver'

interface FilePickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite'
  startIn?: 'desktop' | 'documents' | 'downloads'
}

interface FileSystemFileHandle {
  name: string
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle {
  name: string
  kind: 'directory'
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
  }
}

const EXPORT_DIR_KEY = 'prompt-workbench-export-dir'
const EXPORT_PATH_KEY = 'prompt-workbench-export-path'
const DEFAULT_EXPORT_PATH = '~/.prompt-workbench'
let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null

// Check if browser supports File System Access API
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && !!window.showDirectoryPicker
}

// Get the default export path (shown when no custom path set)
export function getDefaultExportPath(): string {
  return DEFAULT_EXPORT_PATH
}

// Store directory handle in IndexedDB for persistence
async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prompt-workbench', 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles')
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('handles', 'readwrite')
      tx.objectStore('handles').put(handle, EXPORT_DIR_KEY)
      tx.oncomplete = () => {
        cachedDirectoryHandle = handle
        localStorage.setItem(EXPORT_PATH_KEY, handle.name)
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

// Retrieve directory handle from IndexedDB
async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedDirectoryHandle) return cachedDirectoryHandle

  return new Promise((resolve) => {
    const request = indexedDB.open('prompt-workbench', 1)
    request.onerror = () => resolve(null)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles')
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('handles', 'readonly')
      const getReq = tx.objectStore('handles').get(EXPORT_DIR_KEY)
      getReq.onsuccess = () => {
        cachedDirectoryHandle = getReq.result || null
        resolve(getReq.result || null)
      }
      getReq.onerror = () => resolve(null)
    }
  })
}

// Clear stored directory handle
export async function clearDefaultExportPath(): Promise<void> {
  cachedDirectoryHandle = null
  localStorage.removeItem(EXPORT_PATH_KEY)
  return new Promise((resolve) => {
    const request = indexedDB.open('prompt-workbench', 1)
    request.onerror = () => resolve()
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('handles', 'readwrite')
      tx.objectStore('handles').delete(EXPORT_DIR_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    }
  })
}

// Get stored export path for display
export function getStoredExportPath(): string | null {
  return localStorage.getItem(EXPORT_PATH_KEY)
}

// Check if we have a valid directory handle stored
export async function hasValidExportHandle(): Promise<boolean> {
  const handle = await getStoredDirectoryHandle()
  if (!handle) return false
  try {
    const permission = await handle.queryPermission({ mode: 'readwrite' })
    return permission === 'granted'
  } catch {
    return false
  }
}

// Pick and store a default export directory
export async function pickDefaultExportDirectory(): Promise<string | null> {
  if (!window.showDirectoryPicker) return null

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    })
    await storeDirectoryHandle(handle)
    return handle.name
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null
    throw err
  }
}

const RAYCAST_MAX_CHARS = 65536

export interface ExportValidationError {
  snippetName: string
  errors: ResolutionError[]
}

export interface ExportValidationWarning {
  snippetName: string
  charCount: number
  overBy: number
}

export interface ExportValidationResult {
  errors: ExportValidationError[]
  warnings: ExportValidationWarning[]
  includeCount: number
}

/** Validate snippets before export - check for broken refs and size limits */
export function validateExportIncludes(
  snippets: Snippet[],
  allSnippets: Snippet[],
): ExportValidationResult {
  const errors: ExportValidationError[] = []
  const warnings: ExportValidationWarning[] = []
  let includeCount = 0

  for (const s of snippets) {
    const { text, errors: resErrors } = resolveSnippetIncludes(s.text, allSnippets)

    if (resErrors.length > 0) {
      errors.push({ snippetName: s.name, errors: resErrors })
    }

    if (text !== s.text) {
      includeCount++
    }

    if (text.length > RAYCAST_MAX_CHARS) {
      warnings.push({
        snippetName: s.name,
        charCount: text.length,
        overBy: text.length - RAYCAST_MAX_CHARS,
      })
    }
  }

  return { errors, warnings, includeCount }
}

export function snippetsToRaycastJson(snippets: Snippet[], allSnippets?: Snippet[]): RaycastSnippet[] {
  return snippets.map((s) => {
    // Resolve snippet includes if all snippets provided
    let text = s.text
    if (allSnippets) {
      const resolved = resolveSnippetIncludes(s.text, allSnippets)
      text = resolved.text
    }

    const raycast: RaycastSnippet = {
      name: s.name,
      text,
    }
    if (s.keyword) {
      raycast.keyword = s.keyword
    }
    return raycast
  })
}

export async function exportSnippets(snippets: Snippet[], allSnippets?: Snippet[]): Promise<string> {
  const raycastSnippets = snippetsToRaycastJson(snippets, allSnippets)
  const json = JSON.stringify(raycastSnippets, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const defaultFilename = 'raycast-snippets.json'

  // Try File System Access API (Chromium browsers)
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
      // Fall through to server fallback for other errors
    }
  }

  // Fallback for Firefox/Safari: use server-side export to ~/.prompt-workbench
  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippets: raycastSnippets }),
    })
    if (res.ok) {
      const { path } = await res.json()
      return path
    }
  } catch {
    // Fall through to download fallback
  }

  // Final fallback: trigger download to Downloads folder
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

export interface QuickExportOptions {
  autoImportToRaycast?: boolean
}

// Quick export to default directory (no file picker)
export async function quickExportSnippets(
  snippets: Snippet[],
  options: QuickExportOptions = {},
  allSnippets?: Snippet[],
): Promise<{ path: string; autoImportTriggered?: boolean }> {
  const raycastSnippets = snippetsToRaycastJson(snippets, allSnippets)
  const filename = 'raycast-snippets.json'
  const { autoImportToRaycast = false } = options

  // Try stored directory handle first (Chromium browsers) - but not if auto-import requested
  // Auto-import needs server-side to trigger AppleScript
  const handle = !autoImportToRaycast ? await getStoredDirectoryHandle() : null
  if (handle) {
    // Request permission if needed
    let permission = await handle.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      permission = await handle.requestPermission({ mode: 'readwrite' })
      if (permission !== 'granted') {
        throw new Error('Permission denied')
      }
    }

    const json = JSON.stringify(raycastSnippets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })

    const fileHandle = await handle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()

    return { path: `${handle.name}/${filename}` }
  }

  // Server-side export (Firefox/Safari, no custom path, or auto-import requested)
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippets: raycastSnippets, autoImportToRaycast }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error || 'Export failed')
  }

  const { path, autoImportTriggered } = await res.json()
  return { path, autoImportTriggered }
}
