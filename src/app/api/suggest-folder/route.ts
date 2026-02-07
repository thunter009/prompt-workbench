import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_MODEL } from '@/lib/ai-settings-store'

export const dynamic = 'force-dynamic'

interface SuggestFolderRequest {
  snippet: { name: string; text: string; keywords?: string[] }
  existingFolders: string[]
  ollamaUrl?: string
  model?: string
}

interface FolderSuggestion {
  folder: string
  confidence: number
}

interface OllamaGenerateResponse {
  response: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SuggestFolderRequest
    const { snippet, existingFolders, ollamaUrl, model } = body

    if (!snippet?.name || typeof snippet.name !== 'string') {
      return NextResponse.json({ error: 'snippet.name required' }, { status: 400 })
    }

    const url = ollamaUrl || DEFAULT_OLLAMA_URL
    const selectedModel = model || DEFAULT_OLLAMA_MODEL

    const truncatedText = (snippet.text || '').slice(0, 500)
    const keywordsBlock = snippet.keywords?.length
      ? `Keywords: ${snippet.keywords.join(', ')}`
      : ''

    const foldersBlock = existingFolders?.length
      ? `Existing folders:\n${existingFolders.map((f) => `- ${f}`).join('\n')}`
      : 'No existing folders yet.'

    const prompt = `Suggest up to 3 folder names to organize a text snippet. Prefer existing folders when relevant. Each suggestion needs a confidence score 0.0-1.0.

Snippet name: "${snippet.name}"
${keywordsBlock}
Content preview:
${truncatedText}

${foldersBlock}

Return exactly up to 3 lines, format: folder_name|confidence
Example: "Email Templates|0.85"
No explanations. Most confident first.

Suggestions:`

    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        stream: false,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ suggestions: [], model: selectedModel })
    }

    const data = (await response.json()) as OllamaGenerateResponse
    const raw = data.response?.trim() || ''

    const suggestions: FolderSuggestion[] = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('|'))
      .map((line) => {
        const cleaned = line.replace(/^[\d.)\-*"]+\s*/, '').replace(/"/g, '')
        const [folder, conf] = cleaned.split('|').map((s) => s.trim())
        const confidence = Math.min(1, Math.max(0, parseFloat(conf) || 0))
        return { folder, confidence }
      })
      .filter((s) => s.folder.length > 0 && s.folder.length <= 50)
      .slice(0, 3)

    return NextResponse.json({ suggestions, model: selectedModel })
  } catch {
    return NextResponse.json({ suggestions: [], model: '' })
  }
}
