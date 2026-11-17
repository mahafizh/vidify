'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

export function VideoPlayer({ id }: { id: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden bg-black sm:rounded-xl sm:ring-1 sm:ring-white/10">
        <video
          controls
          playsInline
          preload="metadata"
          poster={`/api/thumbnail/${id}?variant=hero`}
          src={`/api/stream/${id}`}
          onError={() => setFailed(true)}
          className="aspect-video w-full bg-black"
        />
      </div>

      {failed ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground/90">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Browser gagal memutar file ini. Formatnya kemungkinan tidak didukung (mis. HEVC/x265 atau audio AC3/DTS).
        </p>
      ) : null}
    </div>
  )
}
