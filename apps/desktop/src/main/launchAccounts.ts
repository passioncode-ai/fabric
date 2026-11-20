// #region launch-accounts — docs: docs/reports/2026-11-20-ceo-access-audit/README.md#needed-held-gap-and-how-it-closes
/**
 * Switchboard's accounts and a folder's group, read for a launch on a chosen account (the owner, 2026-11-20). The one
 * reader of `switchboard --json accounts list` in Fabric's main process (agreed with the session that builds the
 * launch menu): no credential is ever printed by that command, and only the fields a choice needs are kept (id,
 * label, provider, group, on or off, used elsewhere, given to an agent, the share left and its reset). Read at most
 * once a minute; a read that fails answers why, never an empty list that reads as «no accounts».
 *
 * A folder's group is `switchboard shell env --dir <folder>` (tab-separated: pool, context, Claude home, Codex home;
 * `none` for a folder in no group). The launch itself is `switchboard launch <id> --in-place --working-directory
 * <folder> -- <agent args>` (`pty.ts`, a wrapped launch).
 */
import type { LaunchAccount } from '../shared/launchChoice.ts'

export const ACCOUNTS_TTL_MS = 60_000

export type SwitchboardRun = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string } | null>

export type AccountsRead = { ok: true; accounts: LaunchAccount[]; readAt: number } | { ok: false; reason: string }

/** The accounts from `switchboard --json accounts list`; null when the answer is not that shape. */
export function parseLaunchAccounts(stdout: string): LaunchAccount[] | null {
  let raw: unknown
  try { raw = JSON.parse(stdout) } catch { return null /* not JSON: said by the caller */ }
  const list = (raw as { data?: { accounts?: unknown } })?.data?.accounts
  if (!Array.isArray(list)) return null
  const out: LaunchAccount[] = []
  for (const a of list as Array<Record<string, unknown>>) {
    if (typeof a?.id !== 'string' || typeof a.provider !== 'string') continue
    const usage = a.usage as { used_percent?: unknown; resets_at?: unknown } | null | undefined
    const used = typeof usage?.used_percent === 'number' && Number.isFinite(usage.used_percent) ? usage.used_percent : null
    const resets = typeof usage?.resets_at === 'number' ? new Date(usage.resets_at * 1000).toISOString() : null
    out.push({
      id: a.id, label: typeof a.label === 'string' && a.label ? a.label : a.id.slice(0, 8), provider: a.provider,
      pool: typeof a.pool === 'string' && a.pool ? a.pool : 'default', enabled: a.enabled !== false, elsewhere: a.elsewhere === true,
      assigned: a.assigned_to !== null && a.assigned_to !== undefined, leftPct: used === null ? null : Math.max(0, Math.min(100, Math.round(100 - used))), resetsAt: resets
    })
  }
  return out
}

/** A folder's group from `switchboard shell env --dir`: its pool, or null for a folder in no group. */
export function parseFolderPool(stdout: string): string | null {
  const line = stdout.trim().split('\n')[0] ?? ''
  if (!line || line === 'none') return null
  const pool = line.split('\t')[0]?.trim() ?? ''
  return pool && pool !== '-' ? pool : null
}

export function createLaunchAccounts(run: SwitchboardRun, now: () => number = Date.now) {
  let cached: { at: number; read: AccountsRead } | null = null
  let inFlight: Promise<AccountsRead> | null = null

  async function accounts(): Promise<AccountsRead> {
    if (cached && now() - cached.at < ACCOUNTS_TTL_MS) return cached.read
    if (inFlight) return inFlight
    inFlight = (async (): Promise<AccountsRead> => {
      let r
      try { r = await run(['--json', 'accounts', 'list']) } catch (e) { return { ok: false, reason: `Switchboard did not answer: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}` } }
      if (!r) return { ok: false, reason: 'Switchboard is not installed on this computer' }
      if (r.code !== 0) return { ok: false, reason: `switchboard answered ${r.code}: ${r.stderr.slice(0, 160)}` }
      const list = parseLaunchAccounts(r.stdout)
      return list ? { ok: true, accounts: list, readAt: now() } : { ok: false, reason: 'switchboard did not answer its accounts in JSON' }
    })()
    try {
      const read = await inFlight
      // A failed read is not kept: the next ask tries again.
      if (read.ok) cached = { at: now(), read }
      return read
    } finally { inFlight = null }
  }

  async function folderPool(folder: string): Promise<{ ok: true; pool: string | null } | { ok: false; reason: string }> {
    let r
    try { r = await run(['shell', 'env', '--dir', folder]) } catch (e) { return { ok: false, reason: e instanceof Error ? e.message.slice(0, 160) : String(e) } }
    if (!r) return { ok: false, reason: 'Switchboard is not installed on this computer' }
    return { ok: true, pool: parseFolderPool(r.stdout) }
  }

  return { accounts, folderPool }
}

export type LaunchAccounts = ReturnType<typeof createLaunchAccounts>

/** The wrapped launch of an agent on an account: Switchboard runs the agent in the account's own home, in this console. */
export function switchboardLaunchArgs(accountId: string, cwd: string, agentArgs: readonly string[]): string[] {
  return ['launch', accountId, '--in-place', '--working-directory', cwd, '--', ...agentArgs]
}
// #endregion launch-accounts
