import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET() {
  return NextResponse.json(q.getSyncHistory())
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const event = q.createSyncEvent(data)
  return NextResponse.json(event)
}

export async function DELETE() {
  q.clearSyncHistory()
  return NextResponse.json({ ok: true })
}
