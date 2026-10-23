// #region fabric-readiness-read — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-407: runs the PassionCode launcher's doctor read-only, only when the person presses «Проверить» in Settings:
 * `npx --yes @passioncode-ai/passioncode@latest doctor --json`, found on the session PATH, no shell, a 2 min deadline,
 * never `--fix`. It reads the network (npx fetches the launcher), which Settings says beside the button.
 */
import { execFile } from 'node:child_process'
import { parseReadiness, type FabricReadiness } from '../shared/fabricReadiness.ts'
import { findOnPath, widenProbePath } from './executorDetect.ts'

const DEADLINE_MS = 120_000

export async function readFabricReadiness(env: Record<string, string>): Promise<FabricReadiness> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  const npx = await findOnPath('npx', PATH)
  if (!npx) return { ok: false, reason: 'no-npx', detail: null }
  return new Promise((resolve) => {
    execFile(npx, ['--yes', '@passioncode-ai/passioncode@latest', 'doctor', '--json'], { env: { ...env, PATH }, timeout: DEADLINE_MS, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if ((err as { killed?: unknown } | null)?.killed === true) return resolve({ ok: false, reason: 'timeout', detail: null })
      const parsed = parseReadiness(String(stdout))
      // The doctor exits non-zero when a check fails; its JSON is still the answer.
      if (parsed.ok) return resolve(parsed)
      resolve(err ? { ok: false, reason: 'failed', detail: (String(stderr) || err.message).trim().slice(0, 200) } : parsed)
    })
  })
}
// #endregion fabric-readiness-read
