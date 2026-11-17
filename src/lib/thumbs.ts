import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { dataDir } from './paths'

const execFileAsync = promisify(execFile)
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'

export type ThumbnailVariant = 'card' | 'hero'

const WIDTHS: Record<ThumbnailVariant, number> = { card: 480, hero: 1280 }

const inFlight = new Map<string, Promise<string | null>>()

function thumbsDir(): string {
  return path.join(dataDir(), 'thumbs')
}

export function thumbnailPath(id: string, variant: ThumbnailVariant): string {
  return path.join(thumbsDir(), variant === 'hero' ? `${id}-hero.jpg` : `${id}.jpg`)
}

export function isThumbnailVariant(value: string | null): value is ThumbnailVariant {
  return value === 'card' || value === 'hero'
}

export async function ensureThumbnail(
  id: string,
  filePath: string,
  durationSec: number,
  variant: ThumbnailVariant = 'card',
): Promise<string | null> {
  const target = thumbnailPath(id, variant)

  const ready = await fs.access(target).then(
    () => true,
    () => false,
  )
  if (ready) return target

  const key = `${id}:${variant}`
  const running = inFlight.get(key)
  if (running) return running

  const job = generate(target, filePath, durationSec, WIDTHS[variant]).finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

async function generate(target: string, filePath: string, durationSec: number, width: number): Promise<string | null> {
  await fs.mkdir(path.dirname(target), { recursive: true })

  const seek = Math.max(1, Math.min(durationSec * 0.15, 60))

  try {
    await execFileAsync(
      FFMPEG,
      [
        '-v',
        'error',
        '-ss',
        seek.toFixed(1),
        '-i',
        filePath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${width}:-2`,
        '-q:v',
        '4',
        '-y',
        target,
      ],
      { timeout: 30_000 },
    )
    await fs.access(target)
    return target
  } catch (error) {
    console.warn(`[vidify] thumbnail gagal: ${filePath}`, error)
    return null
  }
}
