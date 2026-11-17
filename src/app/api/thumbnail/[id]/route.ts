import fs from 'node:fs/promises'
import { getMedia } from '@/lib/media'
import { resolveInsideLibrary } from '@/lib/paths'
import { ensureThumbnail, isThumbnailVariant } from '@/lib/thumbs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const variantParam = new URL(request.url).searchParams.get('variant')
  const variant = isThumbnailVariant(variantParam) ? variantParam : 'card'

  const media = await getMedia(id)
  if (!media) return new Response('Not found', { status: 404 })

  const filePath = await resolveInsideLibrary(media.path)
  if (!filePath) return new Response('Not found', { status: 404 })

  const thumbnail = await ensureThumbnail(media.id, filePath, media.duration_sec, variant)
  if (!thumbnail) return new Response('Not found', { status: 404 })

  const bytes = await fs.readFile(thumbnail)

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
