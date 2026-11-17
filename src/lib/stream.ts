import fs from 'node:fs'
import { Readable } from 'node:stream'

export type ByteRange = { start: number; end: number }
export type ParsedRange = ByteRange | 'invalid' | null

export function parseRange(header: string | null, size: number): ParsedRange {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'invalid'

  const [, startRaw, endRaw] = match
  if (startRaw === '' && endRaw === '') return 'invalid'
  if (size <= 0) return 'invalid'

  let start: number
  let end: number

  if (startRaw === '') {
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid'
    start = Math.max(size - suffix, 0)
    end = size - 1
  } else {
    start = Number(startRaw)
    end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid'
  if (start >= size || start > end || start < 0) return 'invalid'

  return { start, end }
}

export function fileResponse(
  filePath: string,
  size: number,
  range: ByteRange | null,
  contentType: string,
  withBody: boolean,
): Response {
  const start = range?.start ?? 0
  const end = range?.end ?? Math.max(size - 1, 0)
  const length = size === 0 ? 0 : end - start + 1

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Length': String(length),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
  })
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`)

  const status = range ? 206 : 200

  if (!withBody || size === 0) return new Response(null, { status, headers })

  const stream = fs.createReadStream(filePath, { start, end })
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers })
}
