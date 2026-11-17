export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { bootstrap } = await import('./lib/bootstrap')
  await bootstrap()
}
