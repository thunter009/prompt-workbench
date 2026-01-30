import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') || 'http://localhost:11434'

  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as OllamaTagsResponse
    const models = data.models?.map((m) => m.name) || []

    return NextResponse.json({ models })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
