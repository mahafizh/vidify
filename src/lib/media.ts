import { sql } from './db'

export type MediaRow = {
  id: string
  path: string
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
}

const COLUMNS = 'id, path, title, year, duration_sec, width, height, container, vcodec, acodec, playable, added_at'

export async function listMedia(query: string, limit = 400): Promise<MediaRow[]> {
  if (!query) {
    return sql<MediaRow[]>(`SELECT ${COLUMNS} FROM media ORDER BY added_at DESC, title ASC LIMIT ?`, [limit])
  }

  const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  return sql<MediaRow[]>(
    `SELECT ${COLUMNS} FROM media WHERE title LIKE ? ORDER BY added_at DESC, title ASC LIMIT ?`,
    [pattern, limit],
  )
}

export async function getMedia(id: string): Promise<MediaRow | null> {
  const rows = await sql<MediaRow[]>(`SELECT ${COLUMNS} FROM media WHERE id = ? LIMIT 1`, [id])
  return rows[0] ?? null
}
