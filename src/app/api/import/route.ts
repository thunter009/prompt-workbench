import { NextRequest, NextResponse } from 'next/server'

interface RaycastSnippet {
  name: string
  text: string
  keyword?: string
}

export async function POST(request: NextRequest) {
  try {
    const { snippets } = await request.json()

    if (!Array.isArray(snippets)) {
      return NextResponse.json({ error: 'Invalid snippets format' }, { status: 400 })
    }

    // Validate each snippet has required fields
    const validated: RaycastSnippet[] = []
    const errors: string[] = []

    for (let i = 0; i < snippets.length; i++) {
      const s = snippets[i]
      if (!s.name || typeof s.name !== 'string') {
        errors.push(`Snippet ${i + 1}: missing or invalid name`)
        continue
      }
      if (!s.text || typeof s.text !== 'string') {
        errors.push(`Snippet ${i + 1}: missing or invalid text`)
        continue
      }
      validated.push({
        name: s.name,
        text: s.text,
        keyword: s.keyword || undefined,
      })
    }

    return NextResponse.json({
      success: true,
      imported: validated.length,
      errors: errors.length > 0 ? errors : undefined,
      snippets: validated,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
