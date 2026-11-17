import { EmptyLibrary } from '@/components/empty-library'
import { Hero } from '@/components/hero'
import { MediaGrid } from '@/components/media-grid'
import { MediaRail } from '@/components/media-rail'
import { SiteHeader } from '@/components/site-header'
import { listMedia } from '@/lib/media'

export const dynamic = 'force-dynamic'

const RAIL_SIZE = 12

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const items = await listMedia(query)

  const [featured] = items
  const newest = items.slice(1, RAIL_SIZE + 1)
  const playable = items.filter((item) => item.playable === 1).slice(0, RAIL_SIZE)

  return (
    <div className="min-h-dvh">
      <SiteHeader query={query} />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
        {items.length === 0 ? <EmptyLibrary query={query} /> : null}

        {items.length > 0 && query ? (
          <MediaGrid title={`Hasil untuk "${query}"`} caption={`${items.length} video`} items={items} />
        ) : null}

        {items.length > 0 && !query && featured ? (
          <>
            <Hero item={featured} />
            <MediaRail title="Baru ditambahkan" items={newest} />
            <MediaRail title="Siap diputar" items={playable} />
            <MediaGrid title="Semua video" caption={`${items.length} video`} items={items} />
          </>
        ) : null}
      </main>
    </div>
  )
}
