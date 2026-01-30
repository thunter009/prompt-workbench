import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const DEFAULT_EXPORT_DIR = '.prompt-workbench'
const DEFAULT_FILENAME = 'raycast-snippets.json'

// AppleScript to auto-import into Raycast
function getRaycastImportScript(filePath: string): string {
  return `
    -- Open Raycast import dialog
    do shell script "open 'raycast://extensions/raycast/snippets/import-snippets'"
    delay 0.8

    tell application "System Events"
      -- Wait for file picker dialog
      repeat 15 times
        if exists sheet 1 of window 1 of process "Raycast" then
          exit repeat
        end if
        delay 0.2
      end repeat

      -- Press Cmd+Shift+G to open "Go to folder"
      keystroke "g" using {command down, shift down}
      delay 0.3

      -- Type the file path
      keystroke "${filePath}"
      delay 0.2

      -- Press Enter to go to folder
      keystroke return
      delay 0.5

      -- Press Enter to select the file and import
      keystroke return
    end tell
  `
}

export async function POST(request: NextRequest) {
  try {
    const { snippets, filename = DEFAULT_FILENAME, autoImportToRaycast = false } = await request.json()

    if (!snippets || !Array.isArray(snippets)) {
      return NextResponse.json({ error: 'Invalid snippets data' }, { status: 400 })
    }

    const exportDir = join(homedir(), DEFAULT_EXPORT_DIR)
    const filePath = join(exportDir, filename)

    // Ensure directory exists
    await mkdir(exportDir, { recursive: true })

    // Write snippets JSON
    const json = JSON.stringify(snippets, null, 2)
    await writeFile(filePath, json, 'utf-8')

    // Optionally trigger Raycast import
    if (autoImportToRaycast) {
      const script = getRaycastImportScript(filePath)
      execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`).catch(() => {
        // Ignore errors - user may not have accessibility permissions
      })
    }

    return NextResponse.json({
      success: true,
      path: `~/${DEFAULT_EXPORT_DIR}/${filename}`,
      fullPath: filePath,
      autoImportTriggered: autoImportToRaycast,
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const exportPath = `~/${DEFAULT_EXPORT_DIR}`
  return NextResponse.json({ defaultPath: exportPath })
}
