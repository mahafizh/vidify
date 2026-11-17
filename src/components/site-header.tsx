import Link from 'next/link'
import { Search } from 'lucide-react'
import { ScanButton } from '@/components/scan-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SiteHeader({ query }: { query: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3">
        <Link href="/" className="text-lg font-bold tracking-wide">
          VID<span className="text-primary">IFY</span>
        </Link>

        <ScanButton className="ml-auto sm:order-last sm:ml-0" />

        <form action="/" method="get" className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-80">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari judul..."
              aria-label="Cari judul"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary" size="default">
            Cari
          </Button>
        </form>
      </div>
    </header>
  )
}
