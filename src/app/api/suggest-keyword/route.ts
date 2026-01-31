import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface StyleGuide {
  prefix?: string
  maxLength?: number
  case?: 'lower' | 'upper' | 'camel'
  examples: Array<{ name: string; keyword: string }>
}

interface SuggestKeywordRequest {
  name: string
  text: string
  styleGuide: StyleGuide
  ollamaUrl?: string
  model?: string
}

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
    const body = await request.json() as SuggestKeywordRequest
    const { name, text, styleGuide, ollamaUrl, model } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }
    if (!styleGuide) {
      return NextResponse.json({ error: 'StyleGuide required' }, { status: 400 })
    }

    const url = ollamaUrl || 'http://localhost:11434'
    const selectedModel = model || 'llama3.2'

    // Truncate text to 500 chars if longer
    const truncatedText = text.length > 500 ? text.slice(0, 500) + '...' : text

    // Build few-shot examples (3-5 from styleGuide)
    const exampleCount = Math.min(5, Math.max(3, styleGuide.examples?.length || 0))
    const examples = (styleGuide.examples || []).slice(0, exampleCount)
    const examplesBlock = examples.length > 0
      ? examples.map(e => `- "${e.name}" → ${e.keyword}`).join('\n')
      : '- "Greeting Template" → !greet\n- "API Response Format" → !apiresp\n- "Email Signature" → !sig'

    // Build style rules
    const styleRules: string[] = []
    if (styleGuide.prefix) styleRules.push(`Keywords start with "${styleGuide.prefix}"`)
    if (styleGuide.maxLength) styleRules.push(`Max ${styleGuide.maxLength} characters`)
    if (styleGuide.case === 'lower') styleRules.push('Use lowercase')
    else if (styleGuide.case === 'upper') styleRules.push('Use UPPERCASE')
    else if (styleGuide.case === 'camel') styleRules.push('Use camelCase')

    const styleBlock = styleRules.length > 0
      ? `Style rules:\n${styleRules.map(r => `- ${r}`).join('\n')}`
      : ''

    const prompt = `Generate 5 keyword suggestions for a text snippet. Keywords are short triggers users type to insert the snippet.

Snippet name: "${name}"
Snippet content (preview):
${truncatedText}

${styleBlock}

Examples of existing name→keyword patterns:
${examplesBlock}

Return exactly 5 keyword suggestions, one per line, ranked by relevance (best first). No explanations, just the keywords.

Keywords:`

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
      // Graceful error: return empty suggestions, not 500
      return NextResponse.json({ suggestions: [], model: selectedModel })
    }

    const data = (await response.json()) as OllamaGenerateResponse
    const rawResponse = data.response?.trim() || ''

    // Parse suggestions: split by newlines, clean up, take up to 5
    const suggestions = rawResponse
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[\d.)\-*]+\s*/, '').trim()) // Remove list markers
      .filter(line => line.length > 0 && line.length <= 20) // Sanity check
      .slice(0, 5)

    return NextResponse.json({ suggestions, model: selectedModel })
  } catch {
    // Graceful error handling per AC: return empty suggestions
    return NextResponse.json({ suggestions: [], model: '' })
  }
}
