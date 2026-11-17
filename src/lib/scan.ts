import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PoolConnection } from 'mysql2/promise'
import { getPool, sql } from './db'
import { VIDEO_EXTENSIONS, isDirectPlayable } from './format'
import { libraryRoot } from './paths'
import { probe } from './probe'
import { parseTitle } from './title'

const EXTENSIONS = new Set(VIDEO_EXTENSIONS)
const PROBE_CONCURRENCY = 4
const UPSERT_CHUNK = 50
const DELETE_CHUNK = 200
const SCAN_LOCK = 'vidify_scan'
const PROGRESS_FLUSH = 10

export type ScanStatus = {
  running: boolean
  startedAt: number | null
  finishedAt: number | null
  total: number
  probed: number
  written: number
  skipped: number
  removed: number
  error: string | null
}

type ScanStateRow = {
  running: number
  started_at: number | null
  finished_at: number | null
  total: number
  probed: number
  written: number
  skipped: number
  removed: number
  error: string | null
}

type Counters = { total: number; probed: number; written: number; skipped: number; removed: number }

type MediaWrite = {
  id: string
  path: string
  size: number
  mtime: number
  title: string
  year: number | null
  duration_sec: number
  width: number
  height: number
  container: string
  vcodec: string | null
  acodec: string | null
  playable: number
  added_at: number
  updated_at: number
}

type ExistingRow = { id: string; path: string; size: number; mtime: number }

const EMPTY: ScanStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  total: 0,
  probed: 0,
  written: 0,
  skipped: 0,
  removed: 0,
  error: null,
}

export async function scanStatus(): Promise<ScanStatus> {
  const rows = await sql<ScanStateRow[]>(
    'SELECT running, started_at, finished_at, total, probed, written, skipped, removed, error FROM scan_state WHERE id = 1',
  )
  const row = rows[0]
  if (!row) return { ...EMPTY }

  return {
    running: row.running === 1,
    startedAt: row.started_at === null ? null : Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
    total: Number(row.total),
    probed: Number(row.probed),
    written: Number(row.written),
    skipped: Number(row.skipped),
    removed: Number(row.removed),
    error: row.error,
  }
}

export async function startScan(): Promise<ScanStatus> {
  const connection = await getPool().getConnection()

  const [lockRows] = await connection.query('SELECT GET_LOCK(?, 0) AS locked', [SCAN_LOCK])
  const acquired = (lockRows as Array<{ locked: number | null }>)[0]?.locked === 1

  if (!acquired) {
    connection.release()
    return scanStatus()
  }

  await connection.query(
    `UPDATE scan_state
     SET running = 1, started_at = ?, finished_at = NULL,
         total = 0, probed = 0, written = 0, skipped = 0, removed = 0, error = NULL
     WHERE id = 1`,
    [Date.now()],
  )

  void runAndRelease(connection)

  return scanStatus()
}

async function runAndRelease(connection: PoolConnection): Promise<void> {
  try {
    await runScan(connection)
    await connection.query('UPDATE scan_state SET running = 0, finished_at = ? WHERE id = 1', [Date.now()])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[vidify] scan gagal:', error)
    await connection
      .query('UPDATE scan_state SET running = 0, finished_at = ?, error = ? WHERE id = 1', [Date.now(), message])
      .catch(() => {})
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [SCAN_LOCK]).catch(() => {})
    connection.release()
  }
}

async function runScan(connection: PoolConnection): Promise<void> {
  const files: string[] = []
  await walk(libraryRoot(), files)

  const counters: Counters = { total: files.length, probed: 0, written: 0, skipped: 0, removed: 0 }
  await connection.query('UPDATE scan_state SET total = ? WHERE id = 1', [counters.total])

  const existingRows = await sql<ExistingRow[]>('SELECT id, path, size, mtime FROM media')
  const known = new Map(existingRows.map((row) => [row.path, row]))
  const seen = new Set<string>()

  let pendingFlush = 0
  const results = await mapLimit(files, PROBE_CONCURRENCY, async (file) => {
    const row = await inspect(file, known.get(file), seen, counters)

    pendingFlush++
    if (pendingFlush >= PROGRESS_FLUSH) {
      pendingFlush = 0
      await connection.query('UPDATE scan_state SET probed = ?, skipped = ? WHERE id = 1', [
        counters.probed,
        counters.skipped,
      ])
    }

    return row
  })

  const writes = results.filter((row): row is MediaWrite => row !== null)
  for (let index = 0; index < writes.length; index += UPSERT_CHUNK) {
    await upsert(writes.slice(index, index + UPSERT_CHUNK))
  }
  counters.written = writes.length

  const stale = existingRows.filter((row) => !seen.has(row.path)).map((row) => row.id)
  for (let index = 0; index < stale.length; index += DELETE_CHUNK) {
    const chunk = stale.slice(index, index + DELETE_CHUNK)
    await sql(`DELETE FROM media WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
  }
  counters.removed = stale.length

  await connection.query(
    'UPDATE scan_state SET probed = ?, written = ?, skipped = ?, removed = ? WHERE id = 1',
    [counters.probed, counters.written, counters.skipped, counters.removed],
  )

  console.log(
    `[vidify] scan selesai: ${counters.total} file, ${counters.written} ditulis, ` +
      `${counters.skipped} tidak berubah, ${counters.removed} dihapus`,
  )
}

async function inspect(
  filePath: string,
  known: ExistingRow | undefined,
  seen: Set<string>,
  counters: Counters,
): Promise<MediaWrite | null> {
  const stat = await fs.stat(filePath).catch(() => null)
  if (!stat || !stat.isFile()) return null

  seen.add(filePath)

  const mtime = Math.floor(stat.mtimeMs / 1000)
  if (known && Number(known.size) === stat.size && Number(known.mtime) === mtime) {
    counters.skipped++
    return null
  }

  let details: Awaited<ReturnType<typeof probe>>
  try {
    details = await probe(filePath)
  } catch (error) {
    console.warn(`[vidify] ffprobe gagal, file dilewati: ${filePath}`, error)
    return null
  }

  const container = path.extname(filePath).slice(1).toLowerCase()
  const { title, year } = parseTitle(path.basename(filePath))
  const now = Math.floor(Date.now() / 1000)
  counters.probed++

  return {
    id: crypto.createHash('sha1').update(filePath).digest('hex'),
    path: filePath,
    size: stat.size,
    mtime,
    title,
    year,
    duration_sec: details.durationSec,
    width: details.width,
    height: details.height,
    container,
    vcodec: details.vcodec,
    acodec: details.acodec,
    playable: isDirectPlayable(container, details.vcodec, details.acodec) ? 1 : 0,
    added_at: now,
    updated_at: now,
  }
}

async function upsert(rows: MediaWrite[]): Promise<void> {
  const values = rows.map((row) => [
    row.id,
    row.path,
    row.size,
    row.mtime,
    row.title,
    row.year,
    row.duration_sec,
    row.width,
    row.height,
    row.container,
    row.vcodec,
    row.acodec,
    row.playable,
    row.added_at,
    row.updated_at,
  ])

  await sql(
    `INSERT INTO media
      (id, path, size, mtime, title, year, duration_sec, width, height, container, vcodec, acodec, playable, added_at, updated_at)
     VALUES ?
     ON DUPLICATE KEY UPDATE
      path = VALUES(path), size = VALUES(size), mtime = VALUES(mtime), title = VALUES(title),
      year = VALUES(year), duration_sec = VALUES(duration_sec), width = VALUES(width), height = VALUES(height),
      container = VALUES(container), vcodec = VALUES(vcodec), acodec = VALUES(acodec), playable = VALUES(playable),
      updated_at = VALUES(updated_at)`,
    [values],
  )
}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full)
  }
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await task(items[index])
    }
  })

  await Promise.all(workers)
  return results
}
