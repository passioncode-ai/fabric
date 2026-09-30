import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Installation identity is persistent; boot identifies this host invocation,
 * not an inferred OS boot or permission to signal a previous host's process. */
export function createStopHostIdentity(root: string) {
  const dir = path.join(root, 'stop-host')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = path.join(dir, 'installation-id')
  try { writeFileSync(file, randomUUID(), { flag: 'wx', mode: 0o600 }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  const hostInstanceId = readFileSync(file, 'utf8').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(hostInstanceId))
    throw new Error('Stop host identity is unreadable; preserve recovery records')
  return { hostInstanceId, bootId: randomUUID() }
}
