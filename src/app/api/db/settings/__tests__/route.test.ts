import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as queries from '@/lib/db/queries'
import { PUT } from '../route'

vi.mock('@/lib/db/queries', () => ({
  upsertSettings: vi.fn(),
  getSettings: vi.fn(),
  getAllSettings: vi.fn(),
}))

describe('PUT /api/db/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid JSON body', async () => {
    const request = new NextRequest('http://localhost/api/db/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    })

    const response = await PUT(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(queries.upsertSettings).not.toHaveBeenCalled()
  })

  it('returns 400 when entries is missing', async () => {
    const request = new NextRequest('http://localhost/api/db/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await PUT(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'entries must be an array' })
    expect(queries.upsertSettings).not.toHaveBeenCalled()
  })

  it('returns 400 when entries is not an array', async () => {
    const request = new NextRequest('http://localhost/api/db/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: { key: 'aiSettings', value: { foo: 'bar' } } }),
    })

    const response = await PUT(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'entries must be an array' })
    expect(queries.upsertSettings).not.toHaveBeenCalled()
  })
})
