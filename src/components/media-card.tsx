import Link from 'next/link'
import { Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/lib/format'
import type { MediaRow } from '@/lib/media'
import { cn } from '@/lib/utils'

type MediaCardProps = {
  item: MediaRow
  className?: string
}

export function MediaCard({ item, className }: MediaCardProps) {
  return (
    <Link
      href={`/watch/${item.id}`}
      className={cn('group block rounded-lg outline-none', className)}
      aria-label={`Putar ${item.title}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted ring-1 ring-white/5 transition group-focus-visible:ring-2 group-focus-visible:ring-ring group-hover:ring-white/20">
        <img
          src={`/api/thumbnail/${item.id}`}
          alt=""
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="size-4 fill-current" />
          </span>
        </div>

        {item.playable === 0 ? (
          <Badge variant="destructive" className="absolute top-2 left-2 text-[10px] tracking-wide uppercase">
            Tidak didukung
          </Badge>
        ) : null}

        <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] tabular-nums text-white/90">
          {formatDuration(item.duration_sec)}
        </span>
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-foreground/90 group-hover:text-foreground">
        {item.title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{metaLine(item)}</p>
    </Link>
  )
}

export function metaLine(item: MediaRow): string {
  return [item.year, item.height ? `${item.height}p` : null].filter(Boolean).join(' · ')
}
