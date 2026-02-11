import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ImprovePromptRequest {
  text: string
  systemPrompt: string
  ollamaUrl?: string
  model?: string
}

interface OllamaGenerateResponse {
  response: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ImprovePromptRequest
    const { text, systemPrompt, ollamaUrl, model } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json({ error: 'systemPrompt required' }, { status: 400 })
    }

    const url = ollamaUrl || 'http://localhost:11434'
    const selectedModel = model || 'llama3.2'

    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        system: systemPrompt,
        prompt: text,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const msg = await response.text().catch(() => 'Ollama request failed')
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const data = (await response.json()) as OllamaGenerateResponse
    const improved = data.response?.trim() || ''

    if (!improved) {
      return NextResponse.json({ error: 'Empty response from model' }, { status: 502 })
    }

    return NextResponse.json({ improved, model: selectedModel })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Improve prompt failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
