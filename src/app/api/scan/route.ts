import { scanStatus, startScan } from '@/lib/scan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(await scanStatus())
}

export async function POST() {
  return Response.json(await startScan())
}
