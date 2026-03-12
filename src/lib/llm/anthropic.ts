import type { LLMAdapter, LLMGenerateInput } from './index'

interface AnthropicStreamPayload {
  error?: {
    message?: string
  }
  delta?: {
    text?: string
  }
}

export class AnthropicAdapter implements LLMAdapter {
  constructor(private readonly config: { baseUrl: string; apiKey: string }) {}

  async *generate(input: LLMGenerateInput): AsyncIterable<string> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        stream: true,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.prompt }],
      }),
      signal: input.signal ?? AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => 'Anthropic request failed')
      throw new Error(message)
    }

    if (!response.body) {
      throw new Error('No response body from Anthropic')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const parseEvent = (rawEvent: string): { eventType: string; payloads: string[] } => {
      let eventType = 'message'
      const payloads: string[] = []

      for (const rawLine of rawEvent.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          payloads.push(line.slice(5).trim())
        }
      }

      return { eventType, payloads }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const { eventType, payloads } = parseEvent(rawEvent)

        for (const payload of payloads) {
          let parsed: AnthropicStreamPayload
          try {
            parsed = JSON.parse(payload) as AnthropicStreamPayload
          } catch {
            continue
          }

          if (parsed.error?.message) {
            throw new Error(parsed.error.message)
          }

          if (eventType === 'content_block_delta') {
            const text = parsed.delta?.text
            if (text) {
              yield text
            }
          }
        }

        boundary = buffer.indexOf('\n\n')
      }
    }
  }
}
