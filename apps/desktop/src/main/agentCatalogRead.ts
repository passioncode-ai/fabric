// #region agent-catalog-read — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#настройки-новый-экран
/**
 * Switchboard's catalogue of coding agents, read on this machine for Settings: found on the session PATH (widened
 * the way agent detection widens it), asked once with a 5 s deadline and no shell. Every failure is a named reason
 * (`agentCatalog.ts#readSwitchboardCatalog`); nothing here writes Switchboard's state.
 */
import { execFile } from 'node:child_process'
import { readSwitchboardCatalog, type SwitchboardCatalog } from '../shared/agentCatalog.ts'
import { findOnPath, widenProbePath } from './executorDetect.ts'

const DEADLINE_MS = 5000

export async function readMachineAgentCatalog(env: Record<string, string>): Promise<SwitchboardCatalog> {
  const PATH = await widenProbePath(env.PATH ?? '', env)
  return readSwitchboardCatalog({
    find: () => findOnPath('switchboard', PATH),
    run: (file, args) =>
      new Promise((resolve, reject) => {
        execFile(file, [...args], { env: { ...env, PATH }, timeout: DEADLINE_MS, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
          const exit = (err as { code?: unknown } | null)?.code
          // No numeric exit code means it did not run to an answer (a timeout, a missing binary): a failure to run.
          if (err && typeof exit !== 'number') return reject(err)
          resolve({ code: err ? (exit as number) : 0, stdout: String(stdout), stderr: String(stderr) })
        })
      })
  })
}
// #endregion agent-catalog-read
