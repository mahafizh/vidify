import { MediaCard } from '@/components/media-card'
import type { MediaRow } from '@/lib/media'

type MediaRailProps = {
  title: string
  items: MediaRow[]
}

export function MediaRail({ title, items }: MediaRailProps) {
  if (items.length === 0) return null

  return (
    <section className="animate-fade-in space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length} video</span>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-pl-0 sm:px-0">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} className="w-40 shrink-0 snap-start sm:w-56" />
        ))}
      </div>
    </section>
  )
}
