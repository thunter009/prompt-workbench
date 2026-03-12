import { NextRequest, NextResponse } from 'next/server'
import { createLLMAdapter, type LLMProvider } from '@/lib/llm'

export const dynamic = 'force-dynamic'

interface ImprovePromptRequest {
  text: string
  systemPrompt: string
  provider?: LLMProvider
  model?: string
  ollamaUrl?: string
  openaiBaseUrl?: string
  openaiApiKey?: string
  anthropicBaseUrl?: string
  anthropicApiKey?: string
}

function getDefaultModel(provider: LLMProvider): string {
  if (provider === 'openai') return 'gpt-4o-mini'
  if (provider === 'anthropic') return 'claude-3-5-haiku-latest'
  return 'llama3.2'
}

function encodeSseEvent(encoder: TextEncoder, event: string, payload: Record<string, unknown>) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImprovePromptRequest
    const {
      text,
      systemPrompt,
      provider = 'ollama',
      model,
      ollamaUrl,
      openaiBaseUrl,
      openaiApiKey,
      anthropicBaseUrl,
      anthropicApiKey,
    } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json({ error: 'systemPrompt required' }, { status: 400 })
    }

    const selectedModel = model || getDefaultModel(provider)

    let adapter
    try {
      adapter = createLLMAdapter({
        provider,
        ollamaUrl,
        openaiBaseUrl,
        openaiApiKey,
        anthropicBaseUrl,
        anthropicApiKey,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid LLM provider configuration'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let improved = ''

        const emit = (event: string, payload: Record<string, unknown>) => {
          controller.enqueue(encodeSseEvent(encoder, event, payload))
        }

        try {
          for await (const chunk of adapter.generate({
            prompt: text,
            systemPrompt,
            model: selectedModel,
            signal: request.signal,
          })) {
            if (!chunk) continue

            improved += chunk
            emit('token', {
              text: chunk,
              totalChars: improved.length,
            })
          }

          const trimmed = improved.trim()
          if (!trimmed) {
            emit('error', { error: 'Empty response from model' })
            controller.close()
            return
          }

          emit('done', {
            improved: trimmed,
            model: selectedModel,
            provider,
          })
          controller.close()
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            controller.close()
            return
          }

          const message = err instanceof Error ? err.message : 'Improve prompt stream failed'
          emit('error', { error: message })
          controller.close()
        }
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
