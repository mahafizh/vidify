import { ensureSchema } from './db'
import { startScan } from './scan'

export async function bootstrap(): Promise<void> {
  try {
    await ensureSchema()
    await startScan()
  } catch (error) {
    console.error('[vidify] gagal menyiapkan database:', error)
  }
}
