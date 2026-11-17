const NOISE = new Set([
  '2160p', '1080p', '720p', '480p', '4k', 'uhd', 'hdr', 'hdr10', 'sdr', 'dv',
  'bluray', 'blu', 'ray', 'brrip', 'bdrip', 'webrip', 'webdl', 'hdtv', 'dvdrip', 'remux', 'hdcam',
  'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'av1', '10bit', '8bit', 'hi10p',
  'aac', 'ac3', 'eac3', 'dts', 'ddp', 'truehd', 'flac', 'atmos',
  'proper', 'repack', 'extended', 'unrated', 'uncut', 'remastered', 'directors', 'cut',
  'multi', 'dual', 'sub', 'subs', 'subbed', 'dubbed', 'indo', 'indonesia', 'english', 'eng',
  'nf', 'nfs', 'amzn', 'dsnp', 'hmax', 'atvp', 'yts', 'yify', 'rarbg', 'galaxyrg',
])

const SEPARATORS = /[._]+/g
const BRACKETS = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g
const YEAR = /\b(19\d{2}|20\d{2})\b/

export function parseTitle(fileName: string): { title: string; year: number | null } {
  const base = fileName.replace(/\.[^.]+$/, '')
  const yearMatch = base.match(YEAR)

  let year: number | null = null
  let head = base
  if (yearMatch && yearMatch.index !== undefined) {
    year = Number(yearMatch[0])
    head = base.slice(0, yearMatch.index)
  }

  const title = head
    .replace(BRACKETS, ' ')
    .replace(/[[\](){}]/g, ' ')
    .replace(SEPARATORS, ' ')
    .split(/\s+/)
    .filter((word) => word && !NOISE.has(word.toLowerCase().replace(/-$/, '')))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s-]+$/, '')
    .trim()

  return { title: title || base.trim(), year }
}
