import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  const snippetId = req.nextUrl.searchParams.get('snippetId')
  if (snippetId) {
    return NextResponse.json(q.getVersionsBySnippet(snippetId))
  }
  return NextResponse.json(q.getAllVersions())
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const version = q.createVersion(data)
  return NextResponse.json(version)
}

export async function DELETE(req: NextRequest) {
  const { id, snippetId, pruneKeep } = await req.json()
  if (pruneKeep !== undefined && snippetId) {
    const deleted = q.pruneVersions(snippetId, pruneKeep)
    return NextResponse.json({ deleted })
  }
  if (snippetId) {
    const deleted = q.deleteVersionsBySnippet(snippetId)
    return NextResponse.json(deleted)
  }
  if (id) {
    const deleted = q.deleteVersion(id)
    return NextResponse.json(deleted)
  }
  return NextResponse.json({ error: 'Missing id or snippetId' }, { status: 400 })
}
