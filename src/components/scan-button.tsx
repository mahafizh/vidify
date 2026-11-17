'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ScanStatus = {
  running: boolean
  total: number
  probed: number
  written: number
  skipped: number
  removed: number
  error: string | null
}

export function ScanButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/scan', { cache: 'no-store' })
    if (!response.ok) return

    const next: ScanStatus = await response.json()
    setStatus(next)

    if (!next.running) {
      setBusy(false)
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  async function start() {
    setBusy(true)
    await fetch('/api/scan', { method: 'POST' })
    await refresh()
    stopPolling()
    timer.current = setInterval(refresh, 2000)
  }

  let label = 'Scan'
  if (status?.running) label = `${Math.min(status.probed, status.total)}/${status.total}`
  else if (busy) label = 'Menyiapkan...'

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={start}
      disabled={busy}
      className={cn('h-9 gap-1.5 tabular-nums sm:h-8', className)}
      title={status?.error ?? 'Pindai ulang folder film'}
    >
      {status?.running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {label}
    </Button>
  )
}
