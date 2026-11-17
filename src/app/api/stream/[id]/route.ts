import fs from 'node:fs/promises'
import { contentTypeFor } from '@/lib/format'
import { getMedia } from '@/lib/media'
import { resolveInsideLibrary } from '@/lib/paths'
import { fileResponse, parseRange } from '@/lib/stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request, id: string, withBody: boolean): Promise<Response> {
  const media = await getMedia(id)
  if (!media) return new Response('Not found', { status: 404 })

  const filePath = await resolveInsideLibrary(media.path)
  if (!filePath) return new Response('Not found', { status: 404 })

  const stat = await fs.stat(filePath).catch(() => null)
  if (!stat || !stat.isFile()) return new Response('Not found', { status: 404 })

  const range = parseRange(request.headers.get('range'), stat.size)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' },
    })
  }

  return fileResponse(filePath, stat.size, range, contentTypeFor(media.container), withBody)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handle(request, id, true)
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handle(request, id, false)
}
