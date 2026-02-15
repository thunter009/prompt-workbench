import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  const snippetId = req.nextUrl.searchParams.get('snippetId')
  if (snippetId) {
    return NextResponse.json(q.getPlaygroundRuns(snippetId))
  }
  return NextResponse.json(q.getAllPlaygroundRuns())
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const run = q.createPlaygroundRun(data)
  return NextResponse.json(run)
}
