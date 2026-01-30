import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') || 'http://localhost:11434'

  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { connected: false, error: `HTTP ${response.status}` },
        { status: 200 }
      )
    }

    return NextResponse.json({ connected: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return NextResponse.json({ connected: false, error: message }, { status: 200 })
  }
}
