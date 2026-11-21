// #region launch-choice — docs: docs/reports/2026-11-20-ceo-access-audit/README.md#needed-held-gap-and-how-it-closes
/**
 * Which agent and which account a session starts on (the owner, 2026-11-20: start a session «with the agent I pick, or
 * on the subscription I pick», by the menu, the CEO or its voice). One rule for every door: the CEO's start, the voice
 * and the launch menu (another session builds the menu on this module).
 *
 * An account is Switchboard's (`switchboard --json accounts list`). It serves one provider: Claude Code runs on a
 * `claude` account, Codex on a `codex` one; other agents take no account. Switchboard launches an account of a group
 * only from that group's folders, and an account of the default group anywhere (measured 2026-11-20:
 * `switchboard launch <id> --in-place` from another folder answers «This account belongs to a group. Launch it from
 * one of the group's folders»). An account turned off, used on another machine, or given to an agent is never offered.
 *
 * Pure: the accounts and the folder's group are read by the host (`main/launchAccounts.ts`).
 */

export interface LaunchAccount {
  id: string
  label: string
  provider: string
  /** The group (Switchboard's pool); `default` for the default group. */
  pool: string
  enabled: boolean
  elsewhere: boolean
  assigned: boolean
  /** The share of the account's quota left now, 0..100; null when unknown (never read as 0). */
  leftPct: number | null
  /** When the window that limits it resets, ISO; null when unknown. */
  resetsAt: string | null
}

export interface LaunchChoice { runner: string; account?: string | null }

/** The provider an agent runs on, for the agents that take a Switchboard account. */
export const PROVIDER_OF: Readonly<Record<string, string>> = { 'claude-code': 'claude', codex: 'codex' }

/** The accounts a session of `runner` may start on in a folder of group `pool` (null: the folder is in no group). */
export function accountsFor(runner: string, pool: string | null, accounts: readonly LaunchAccount[]): LaunchAccount[] {
  const provider = PROVIDER_OF[runner]
  if (!provider) return []
  return accounts
    .filter((a) => a.provider === provider && a.enabled && !a.elsewhere && !a.assigned && (a.pool === 'default' || (pool !== null && a.pool === pool)))
    // The most quota left first; an unknown share after the known ones.
    .sort((x, y) => (y.leftPct ?? -1) - (x.leftPct ?? -1))
}

export interface ChoiceOption extends LaunchChoice { label: string; leftPct: number | null; isDefault: boolean }

/** The choices for a project: its default agent first (on the account Switchboard would pick), then each agent on each
 *  account it may use there, the most quota left first, then the other agents. */
export function launchChoices(input: { defaultRunner: string; runners: readonly { id: string; label: string; installed: boolean }[]; pool: string | null; accounts: readonly LaunchAccount[] }): { default: LaunchChoice; options: ChoiceOption[] } {
  const options: ChoiceOption[] = []
  const runners = [...input.runners].filter((r) => r.installed)
  const ordered = [...runners.filter((r) => r.id === input.defaultRunner), ...runners.filter((r) => r.id !== input.defaultRunner)]
  for (const r of ordered) {
    const isDefault = r.id === input.defaultRunner
    options.push({ runner: r.id, account: null, label: isDefault ? `${r.label} (default)` : r.label, leftPct: null, isDefault })
    for (const a of accountsFor(r.id, input.pool, input.accounts)) options.push({ runner: r.id, account: a.id, label: `${r.label}: ${a.label}`, leftPct: a.leftPct, isDefault: false })
  }
  return { default: { runner: input.defaultRunner, account: null }, options }
}

/** An account named as the owner said it: its id, its whole label, the name the CEO says («work@…», ceoTools.ts#accountName),
 *  or a word of the label (one match only). Several matches come back as the accounts, so the caller says them by name
 *  and id, never by the whole label (the 0.3.28 review, iteration 3, DA-16). */
export function findAccount(name: string, accounts: readonly LaunchAccount[]): { found: LaunchAccount } | { ambiguous: LaunchAccount[] } | { missing: true } {
  const q = String(name ?? '').trim().toLowerCase()
  if (!q) return { missing: true }
  const byId = accounts.find((a) => a.id.toLowerCase() === q || a.id.toLowerCase().startsWith(q) && q.length >= 8)
  if (byId) return { found: byId }
  const said = q.endsWith('@…') || q.endsWith('@...') ? q.slice(0, q.indexOf('@') + 1) : null
  const exact = accounts.filter((a) => said ? a.label.toLowerCase().startsWith(said) : a.label.toLowerCase() === q)
  if (exact.length === 1) return { found: exact[0]! }
  const part = said ? exact : accounts.filter((a) => a.label.toLowerCase().includes(q))
  if (part.length === 1) return { found: part[0]! }
  if (part.length > 1 || exact.length > 1) return { ambiguous: (exact.length > 1 ? exact : part).slice(0, 3) }
  return { missing: true }
}

/** The agents as they are spoken, Russian and English: «на Codex», «кодекс», «на клоде», «Kimi». */
const SPOKEN_RUNNERS: ReadonlyArray<[RegExp, string]> = [
  [/\b(claude(\s*code)?|клод\w*|клауд\w*)\b/iu, 'claude-code'],
  [/\b(codex|кодекс\w*)\b/iu, 'codex'],
  [/\b(hermes|гермес\w*|хермес\w*)\b/iu, 'hermes'],
  [/\b(kimi(\s*code)?|кими)\b/iu, 'kimi-code'],
  [/\b(kilo|кило)\b/iu, 'kilo']
]

/** What the owner said about the agent and the account: «на Codex», «на аккаунте Y», «на подписке Y». */
export function parseSpokenChoice(text: string): { runner?: string; account?: string } {
  const s = String(text ?? '')
  const out: { runner?: string; account?: string } = {}
  // \b does not see Cyrillic letters as word letters in every engine: look for the word with spaces around instead.
  const padded = ` ${s.toLowerCase()} `
  for (const [re, id] of SPOKEN_RUNNERS) {
    const plain = new RegExp(re.source.replace(/\\b/g, '(?:^|$|[\\s,.!?«»"\'])'), 'iu')
    if (plain.test(padded)) { out.runner = id; break }
  }
  const acc = /(?:на\s+)?(?:аккаунте|аккаунт|подписке|подписку|account|subscription)\s+([^\s,!?«»"']+)/iu.exec(s)
  // A full stop that ends the sentence is not part of the name.
  if (acc) out.account = acc[1]!.replace(/\.+$/, '')
  return out
}
// #endregion launch-choice
