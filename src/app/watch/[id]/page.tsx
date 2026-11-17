import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { VideoPlayer } from '@/components/video-player'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import { getMedia } from '@/lib/media'

export const dynamic = 'force-dynamic'

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const media = await getMedia(id)

  if (!media) notFound()

  const facts = [
    media.year ? { label: 'Tahun', value: String(media.year) } : null,
    { label: 'Durasi', value: formatDuration(media.duration_sec) },
    media.height ? { label: 'Resolusi', value: `${media.width}×${media.height}` } : null,
    { label: 'Format', value: `${media.container.toUpperCase()} · ${media.vcodec ?? '—'} / ${media.acodec ?? '—'}` },
  ].filter((fact): fact is { label: string; value: string } => fact !== null)

  return (
    <div className="min-h-dvh bg-black">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Library
            </Link>
          </Button>
          <h1 className="truncate text-sm font-medium sm:text-base">
            {media.title}
            {media.year ? ` (${media.year})` : ''}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 pb-10 sm:px-4 sm:py-4">
        <VideoPlayer id={media.id} />

        {media.playable === 0 ? (
          <p className="mx-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200 sm:mx-0">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Browser kemungkinan tidak bisa memutar file ini. Formatnya perlu dikonversi dulu ke MP4 H.264 + AAC.
          </p>
        ) : null}

        <dl className="mx-4 grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-card/60 p-4 sm:mx-0 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="space-y-0.5">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{fact.label}</dt>
              <dd className="truncate text-sm">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mx-4 sm:mx-0">
          <Button asChild variant="secondary">
            <Link href="/">Kembali ke library</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
