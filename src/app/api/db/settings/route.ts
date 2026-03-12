import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  const keys = req.nextUrl.searchParams.get('keys')
  if (keys) {
    return NextResponse.json(q.getSettings(keys.split(',')))
  }
  return NextResponse.json(q.getAllSettings())
}

export async function PUT(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const entries = (payload as { entries?: Array<{ key: string; value: unknown }> }).entries
  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
  }

  q.upsertSettings(entries)
  return NextResponse.json({ ok: true })
}
