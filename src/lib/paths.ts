import fs from 'node:fs/promises'
import path from 'node:path'

export function libraryRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.LIBRARY_ROOT || './media')
}

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || './data')
}

export async function resolveInsideLibrary(candidate: string): Promise<string | null> {
  const root = await fs.realpath(/*turbopackIgnore: true*/ libraryRoot()).catch(() => null)
  if (!root) return null

  const resolved = await fs.realpath(/*turbopackIgnore: true*/ candidate).catch(() => null)
  if (!resolved) return null

  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  return resolved
}
