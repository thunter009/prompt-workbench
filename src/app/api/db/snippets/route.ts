import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET() {
  const snippets = q.getAllSnippets()
  return NextResponse.json(snippets)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const snippet = q.createSnippet(data)
  return NextResponse.json(snippet)
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const snippet = q.updateSnippet(id, data)
  return NextResponse.json(snippet)
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json()
  const deleted = q.deleteSnippets(ids)
  return NextResponse.json(deleted)
}
