import { FolderOpen } from 'lucide-react'

export function EmptyLibrary({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-20 text-center">
      <FolderOpen className="size-8 text-muted-foreground" />
      <h2 className="text-base font-semibold">{query ? 'Tidak ada hasil' : 'Library masih kosong'}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {query
          ? `Tidak ada judul yang cocok dengan "${query}". Coba kata kunci lain.`
          : 'Pastikan MEDIA_ROOT menunjuk ke folder film, lalu tekan tombol Scan di kanan atas.'}
      </p>
    </div>
  )
}
