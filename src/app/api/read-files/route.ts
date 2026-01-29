import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { normalize, join } from 'path'

export const dynamic = 'force-dynamic'

// Security: only allow reading from Raycast directory
const ALLOWED_BASE = join(homedir(), 'Library', 'Application Support', 'Raycast')

function isPathAllowed(filePath: string): boolean {
  const normalized = normalize(filePath)
  return normalized.startsWith(ALLOWED_BASE) && normalized.endsWith('.json')
}

export async function POST(request: NextRequest) {
  try {
    const { paths } = await request.json()

    if (!Array.isArray(paths)) {
      return NextResponse.json({ error: 'paths must be array' }, { status: 400 })
    }

    const results: Record<string, string | null> = {}

    for (const path of paths) {
      if (typeof path !== 'string') continue

      if (!isPathAllowed(path)) {
        results[path] = null
        continue
      }

      try {
        const content = await readFile(path, 'utf-8')
        results[path] = content
      } catch {
        results[path] = null
      }
    }

    return NextResponse.json({ files: results })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
