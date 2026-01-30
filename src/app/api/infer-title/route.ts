import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface OllamaGenerateRequest {
  model: string
  prompt: string
  stream: false
}

interface OllamaGenerateResponse {
  response: string
}

export async function POST(request: NextRequest) {
  try {
    const { content, ollamaUrl, model } = await request.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    const url = ollamaUrl || 'http://localhost:11434'
    const selectedModel = model || 'llama3.2'

    // Truncate content to avoid massive prompts (first 500 chars)
    const truncatedContent = content.slice(0, 500)

    const prompt = `Generate a short, descriptive title (max 5 words) for this text snippet. Return ONLY the title, no quotes or explanation.

Text:
${truncatedContent}

Title:`

    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        stream: false,
      } as OllamaGenerateRequest),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as OllamaGenerateResponse
    const title = data.response?.trim().replace(/^["']|["']$/g, '') || 'Untitled'

    // Limit title length
    const finalTitle = title.length > 50 ? title.slice(0, 47) + '...' : title

    return NextResponse.json({ title: finalTitle })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inference failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
