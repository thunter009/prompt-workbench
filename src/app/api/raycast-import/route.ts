import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat, readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface RaycastSnippet {
  name: string
  text: string
  keyword?: string
}

// Known locations where Raycast might export snippets
const EXPORT_LOCATIONS = [
  join(homedir(), '.prompt-workbench', 'raycast-snippets.json'),
  join(homedir(), 'Downloads', 'raycast-snippets.json'),
]

async function findLatestExport(): Promise<{ path: string; mtime: Date } | null> {
  let latest: { path: string; mtime: Date } | null = null

  for (const path of EXPORT_LOCATIONS) {
    try {
      const stats = await stat(path)
      if (!latest || stats.mtime > latest.mtime) {
        latest = { path, mtime: stats.mtime }
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return latest
}

async function parseSnippetsFile(path: string): Promise<RaycastSnippet[]> {
  const content = await readFile(path, 'utf-8')
  const data = JSON.parse(content)

  // Handle both array format and object with snippets key
  const snippetsArray = Array.isArray(data) ? data : data.snippets

  if (!Array.isArray(snippetsArray)) {
    throw new Error('Invalid file format')
  }

  return snippetsArray
    .filter((s: unknown): s is RaycastSnippet =>
      typeof s === 'object' && s !== null &&
      typeof (s as RaycastSnippet).name === 'string' &&
      typeof (s as RaycastSnippet).text === 'string'
    )
    .map((s) => ({
      name: s.name,
      text: s.text,
      keyword: s.keyword || undefined,
    }))
}

const WORKBENCH_DIR = join(homedir(), '.prompt-workbench')

interface AvailableFile {
  name: string
  path: string
  age: string
  snippetCount: number
  mtimeMs: number
}

async function listJsonFiles(): Promise<AvailableFile[]> {
  const files: AvailableFile[] = []
  try {
    const entries = await readdir(WORKBENCH_DIR)
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const fullPath = join(WORKBENCH_DIR, entry)
      try {
        const stats = await stat(fullPath)
        const snippets = await parseSnippetsFile(fullPath)
        const ageMs = Date.now() - stats.mtime.getTime()
        const ageMinutes = Math.floor(ageMs / 60000)
        files.push({
          name: entry,
          path: fullPath,
          age: ageMinutes < 60
            ? `${ageMinutes}m ago`
            : `${Math.floor(ageMinutes / 60)}h ago`,
          snippetCount: snippets.length,
          mtimeMs: stats.mtime.getTime(),
        })
      } catch {
        // skip unparseable files
      }
    }
  } catch {
    // dir doesn't exist
  }
  // Most recent first
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

// GET: Check for existing export file + list available files
export async function GET(request: NextRequest) {
  const loadFile = request.nextUrl.searchParams.get('file')

  // Load a specific file by name
  if (loadFile) {
    try {
      const fullPath = join(WORKBENCH_DIR, loadFile)
      // Prevent path traversal
      if (!fullPath.startsWith(WORKBENCH_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }
      const snippets = await parseSnippetsFile(fullPath)
      return NextResponse.json({ found: true, path: fullPath, snippetCount: snippets.length, snippets })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to read file' },
        { status: 500 }
      )
    }
  }

  try {
    const latest = await findLatestExport()
    const availableFiles = await listJsonFiles()

    if (!latest) {
      return NextResponse.json({
        found: false,
        availableFiles,
        message: 'No Raycast export found. Use the trigger endpoint to open export dialog.',
      })
    }

    const snippets = await parseSnippetsFile(latest.path)
    const ageMs = Date.now() - latest.mtime.getTime()
    const ageMinutes = Math.floor(ageMs / 60000)

    return NextResponse.json({
      found: true,
      path: latest.path,
      modifiedAt: latest.mtime.toISOString(),
      age: ageMinutes < 60
        ? `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`
        : `${Math.floor(ageMinutes / 60)} hour${Math.floor(ageMinutes / 60) !== 1 ? 's' : ''} ago`,
      snippetCount: snippets.length,
      snippets,
      availableFiles,
    })
  } catch (error) {
    console.error('Error checking for export:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check for export' },
      { status: 500 }
    )
  }
}

// POST: Trigger Raycast export dialog
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({ action: 'trigger' }))

    if (action === 'trigger') {
      // Open Raycast export dialog via deeplink
      await execAsync('open "raycast://extensions/raycast/snippets/export-snippets"')

      // Try to automate the save dialog with AppleScript
      // This navigates to ~/.prompt-workbench and saves
      const appleScript = `
        delay 0.5
        tell application "System Events"
          -- Wait for save dialog
          repeat 10 times
            if exists sheet 1 of window 1 of process "Raycast" then
              exit repeat
            end if
            delay 0.2
          end repeat

          -- Press Cmd+Shift+G to open "Go to folder" dialog
          keystroke "g" using {command down, shift down}
          delay 0.3

          -- Type the path
          keystroke "~/.prompt-workbench"
          delay 0.2

          -- Press Enter to go to folder
          keystroke return
          delay 0.3

          -- Press Enter to save
          keystroke return
        end tell
      `

      // Run AppleScript in background (don't wait for it)
      execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`).catch(() => {
        // Ignore errors - user may not have accessibility permissions
      })

      return NextResponse.json({
        success: true,
        message: 'Raycast export dialog opened. Attempting to auto-save to ~/.prompt-workbench',
        autoSaveAttempted: true,
      })
    }

    if (action === 'import') {
      // Find and return the latest export for client-side import
      const latest = await findLatestExport()

      if (!latest) {
        return NextResponse.json({
          success: false,
          error: 'No export file found. Export from Raycast first.',
        }, { status: 404 })
      }

      const snippets = await parseSnippetsFile(latest.path)

      return NextResponse.json({
        success: true,
        path: latest.path,
        snippets,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Raycast import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
