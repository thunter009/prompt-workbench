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
  const { entries } = await req.json() as { entries: Array<{ key: string; value: unknown }> }
  q.upsertSettings(entries)
  return NextResponse.json({ ok: true })
}
