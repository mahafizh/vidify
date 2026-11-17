import { MediaCard } from '@/components/media-card'
import type { MediaRow } from '@/lib/media'

type MediaGridProps = {
  title: string
  caption?: string
  items: MediaRow[]
}

export function MediaGrid({ title, caption, items }: MediaGridProps) {
  if (items.length === 0) return null

  return (
    <section className="animate-fade-in space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
