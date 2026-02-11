import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RunRequest {
  prompt: string
  model: string
  ollamaUrl: string
  systemPrompt?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RunRequest
    const { prompt, model, ollamaUrl, systemPrompt } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    }
    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'model required' }, { status: 400 })
    }

    const url = ollamaUrl || 'http://localhost:11434'

    const ollamaBody: Record<string, unknown> = {
      model,
      prompt,
      stream: true,
    }
    if (systemPrompt) {
      ollamaBody.system = systemPrompt
    }

    const ollamaRes = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaBody),
      signal: AbortSignal.timeout(60000),
    })

    if (!ollamaRes.ok) {
      const msg = await ollamaRes.text().catch(() => 'Ollama request failed')
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    if (!ollamaRes.body) {
      return NextResponse.json({ error: 'No response body from Ollama' }, { status: 502 })
    }

    // Pipe Ollama's streaming NDJSON through to the client
    const reader = ollamaRes.body.getReader()
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        controller.enqueue(value)
      },
      cancel() {
        reader.cancel()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Run failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
