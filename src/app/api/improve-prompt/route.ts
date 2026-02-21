import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ImprovePromptRequest {
  text: string
  systemPrompt: string
  ollamaUrl?: string
  model?: string
}

interface OllamaGenerateChunk {
  response?: string
  done?: boolean
  error?: string
}

function encodeSseEvent(encoder: TextEncoder, event: string, payload: Record<string, unknown>) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
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
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const msg = await response.text().catch(() => 'Ollama request failed')
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    if (!response.body) {
      return NextResponse.json({ error: 'No response body from model' }, { status: 502 })
    }

    const reader = response.body.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = ''
        let improved = ''

        const emit = (event: string, payload: Record<string, unknown>) => {
          controller.enqueue(encodeSseEvent(encoder, event, payload))
        }

        const handleLine = (rawLine: string) => {
          const line = rawLine.trim()
          if (!line) return

          let parsed: OllamaGenerateChunk
          try {
            parsed = JSON.parse(line) as OllamaGenerateChunk
          } catch {
            return
          }

          if (parsed.error) {
            throw new Error(parsed.error)
          }

          if (parsed.response) {
            improved += parsed.response
            emit('token', {
              text: parsed.response,
              totalChars: improved.length,
            })
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              handleLine(line)
            }
          }

          buffer += decoder.decode()
          if (buffer) {
            const remaining = buffer.split('\n')
            for (const line of remaining) {
              handleLine(line)
            }
          }

          const trimmed = improved.trim()
          if (!trimmed) {
            emit('error', { error: 'Empty response from model' })
            controller.close()
            return
          }

          emit('done', { improved: trimmed, model: selectedModel })
          controller.close()
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Improve prompt stream failed'
          emit('error', { error: message })
          controller.close()
        }
      },
      cancel() {
        void reader.cancel()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Improve prompt failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
