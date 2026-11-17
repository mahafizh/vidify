import Link from 'next/link'
import { Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import type { MediaRow } from '@/lib/media'

export function Hero({ item }: { item: MediaRow }) {
  return (
    <section className="animate-fade-in relative overflow-hidden rounded-xl border border-white/5">
      <img src={`/api/thumbnail/${item.id}?variant=hero`} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />

      <div className="relative flex min-h-56 flex-col justify-end gap-3 p-5 sm:min-h-80 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Terbaru</Badge>
          {item.year ? <span>{item.year}</span> : null}
          <span aria-hidden>·</span>
          <span>{formatDuration(item.duration_sec)}</span>
          {item.height ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.height}p</span>
            </>
          ) : null}
        </div>

        <h1 className="max-w-2xl text-2xl leading-tight font-semibold sm:text-4xl">{item.title}</h1>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="lg">
            <Link href={`/watch/${item.id}`}>
              <Play className="size-4 fill-current" />
              Putar
            </Link>
          </Button>

          {item.playable === 0 ? <Badge variant="destructive">Format tidak didukung browser</Badge> : null}
        </div>
      </div>
    </section>
  )
}
