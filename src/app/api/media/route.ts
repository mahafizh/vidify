import { listMedia } from '@/lib/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim()
  const items = await listMedia(query)
  return Response.json({ items })
}
