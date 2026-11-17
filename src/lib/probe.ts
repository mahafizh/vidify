import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe'

export type ProbeResult = {
  durationSec: number
  width: number
  height: number
  vcodec: string | null
  acodec: string | null
}

type ProbeStream = {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
}

type ProbeOutput = {
  format?: { duration?: string }
  streams?: ProbeStream[]
}

export async function probe(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    FFPROBE,
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 },
  )

  const output = JSON.parse(stdout) as ProbeOutput
  const video = output.streams?.find((stream) => stream.codec_type === 'video')
  const audio = output.streams?.find((stream) => stream.codec_type === 'audio')

  return {
    durationSec: Number(output.format?.duration ?? 0),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    vcodec: video?.codec_name ?? null,
    acodec: audio?.codec_name ?? 'none',
  }
}
