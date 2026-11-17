export const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.mkv', '.webm']

const MP4_CONTAINERS = new Set(['mp4', 'm4v', 'mov'])
const MP4_VIDEO = new Set(['h264'])
const MP4_AUDIO = new Set(['aac', 'mp3', 'none'])

const WEBM_CONTAINERS = new Set(['webm'])
const WEBM_VIDEO = new Set(['vp8', 'vp9', 'av1'])
const WEBM_AUDIO = new Set(['opus', 'vorbis', 'none'])

export function isDirectPlayable(container: string, vcodec: string | null, acodec: string | null): boolean {
  const video = (vcodec ?? '').toLowerCase()
  const audio = (acodec ?? 'none').toLowerCase()

  if (MP4_CONTAINERS.has(container)) return MP4_VIDEO.has(video) && MP4_AUDIO.has(audio)
  if (WEBM_CONTAINERS.has(container)) return WEBM_VIDEO.has(video) && WEBM_AUDIO.has(audio)
  return false
}

export function contentTypeFor(container: string): string {
  return container === 'webm' ? 'video/webm' : 'video/mp4'
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'

  const total = Math.round(seconds)
  if (total < 60) return `${total}s`

  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`
}
