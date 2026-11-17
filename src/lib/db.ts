import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise'

type Cache = {
  pool?: Pool
  schema?: Promise<void>
}

const globalCache = globalThis as unknown as { __vidify?: Cache }
const cache: Cache = (globalCache.__vidify ??= {})

const DEFAULT_DATABASE_URL = 'mysql://vidify:vidify@127.0.0.1:3306/vidify'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS media (
    id            CHAR(40)     NOT NULL PRIMARY KEY,
    path          TEXT         NOT NULL,
    size          BIGINT       NOT NULL,
    mtime         BIGINT       NOT NULL,
    title         VARCHAR(512) NOT NULL,
    year          SMALLINT     NULL,
    duration_sec  DOUBLE       NOT NULL DEFAULT 0,
    width         INT          NOT NULL DEFAULT 0,
    height        INT          NOT NULL DEFAULT 0,
    container     VARCHAR(16)  NOT NULL,
    vcodec        VARCHAR(32)  NULL,
    acodec        VARCHAR(32)  NULL,
    playable      TINYINT(1)   NOT NULL DEFAULT 0,
    added_at      BIGINT       NOT NULL,
    updated_at    BIGINT       NOT NULL,
    KEY idx_title (title(191)),
    KEY idx_added (added_at)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS progress (
    media_id      CHAR(40) NOT NULL PRIMARY KEY,
    position_sec  DOUBLE   NOT NULL DEFAULT 0,
    duration_sec  DOUBLE   NOT NULL DEFAULT 0,
    updated_at    BIGINT   NOT NULL,
    CONSTRAINT fk_progress_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS scan_state (
    id           TINYINT  NOT NULL PRIMARY KEY,
    running      TINYINT(1) NOT NULL DEFAULT 0,
    started_at   BIGINT   NULL,
    finished_at  BIGINT   NULL,
    total        INT      NOT NULL DEFAULT 0,
    probed       INT      NOT NULL DEFAULT 0,
    written      INT      NOT NULL DEFAULT 0,
    skipped      INT      NOT NULL DEFAULT 0,
    removed      INT      NOT NULL DEFAULT 0,
    error        TEXT     NULL
  ) ENGINE=InnoDB`,
  'INSERT IGNORE INTO scan_state (id) VALUES (1)',
]

export function getPool(): Pool {
  if (!cache.pool) {
    cache.pool = mysql.createPool(process.env.DATABASE_URL || DEFAULT_DATABASE_URL)
  }
  return cache.pool
}

async function migrate(pool: Pool): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      for (const statement of SCHEMA) await pool.query(statement)
      return
    } catch (error) {
      if (attempt === 5) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
}

export function ensureSchema(): Promise<void> {
  cache.schema ??= migrate(getPool()).catch((error) => {
    cache.schema = undefined
    throw error
  })
  return cache.schema
}

export async function sql<T = RowDataPacket[]>(statement: string, params: unknown[] = []): Promise<T> {
  await ensureSchema()
  const [rows] = await getPool().query(statement, params)
  return rows as T
}
