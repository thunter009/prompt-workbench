import { NextRequest, NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

export async function GET() {
  const folders = q.getAllFolders()
  return NextResponse.json(folders)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const folder = q.createFolder(data)
  return NextResponse.json(folder)
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const folder = q.updateFolder(id, data)
  return NextResponse.json(folder)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const folder = q.deleteFolder(id)
  return NextResponse.json(folder)
}
