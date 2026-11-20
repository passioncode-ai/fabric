// #region session-meta — docs: docs/ux/scenarios.md#scn-188-read-a-consoles-system-line
/**
 * A console's system line (the owner, 2026-11-20, 20:59: «в дашборде … видно … с какого она аккаунта, … кто ее
 * вытащил … Давай ее в фабрике тоже сделаем, … внизу в строчечке … плюс … папка, ветка»): which account it runs on,
 * who started it and how, the organisation it works for, the runner and model, the folder and the branch, and the two
 * ids. Pure: what main read (the launch journal, Switchboard's own answers, git, the transcript's tail) comes in, the
 * line's facts come out. Where the account and the context come from is Switchboard's, read the way Fabric Dashboards
 * reads it (`shared/vendor/dashboardsSessions.ts` for the session records), never guessed here.
 */
import type { Launch } from './sessionLaunches.ts'

/** A session Switchboard launched, as much of its record as the line needs. */
export interface SbSessionLite {
  providerSessionId: string | null
  folder: string
  label: string
  contextName: string | null
  context: string | null
  /** Where Switchboard was asked: `fallback` and `recovery` are a hand-over after a limit. */
  surface: string | null
  launchedAt: number | null
}

/** What Switchboard answered about this machine, each part null when it was not read. */
export interface SwitchboardView {
  sessions: SbSessionLite[] | null
  /** `provider:pool` → account id (`accounts list`). */
  routes: Record<string, string> | null
  /** account id → its label (an e-mail for a Claude account). */
  labels: Record<string, string> | null
  /** group id → its organisation's name (`project list`). */
  groupOrg: Record<string, string> | null
  /** The console folder's group and context (`shell env --dir`), or null when the folder is in no group. */
  folder: { pool: string; context: string | null } | null
}

export interface SessionMetaInput {
  sessionId: string
  cwd: string
  /** The runner's catalogue id (`claude-code`, `codex`, `shell`, …). */
  runner: string
  startedAt: string
  launch: Launch | null
  switchboard: SwitchboardView | null
  branch: string | null
  model: string | null
}

export type AccountSource = 'switchboard-session' | 'group-route'

export interface SessionMeta {
  sessionId: string
  runnerSessionId: string | null
  runner: string
  model: string | null
  folder: string
  branch: string | null
  /** The account's label (an e-mail) and how it was found; null when Switchboard did not say. */
  account: { label: string; short: string; source: AccountSource } | null
  /** The organisation the session works for, as Switchboard names it; `personal` for a personal context. */
  context: string | null
  /** Who started it: Fabric's own journal first, else Switchboard's record. */
  started: { by: string; via: string | null; at: string | null; parentSessionId: string | null } | null
  /** Switchboard handed it over (a hand-over after a limit, or a dispatch), with when. */
  handedOver: { at: string | null } | null
}

/** The provider Switchboard routes a runner through. */
export function providerOf(runner: string): string | null {
  if (runner === 'claude-code') return 'claude'
  if (runner === 'codex') return 'codex'
  return null
}

/** An e-mail as its local part and «@…» (the whole on hover); any other label cut at 18 characters. */
export function shortAccount(label: string): string {
  const at = label.indexOf('@')
  if (at > 0) return `${label.slice(0, at)}@…`
  return label.length > 18 ? `${label.slice(0, 17)}…` : label
}

const sameFolder = (a: string, b: string): boolean => a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

/** The Switchboard record of this console: by the runner's own session id, else the same folder launched within 20 s. */
export function recordOf(input: Pick<SessionMetaInput, 'cwd' | 'startedAt' | 'launch'>, sessions: readonly SbSessionLite[]): SbSessionLite | null {
  const own = input.launch?.runnerSessionId ?? null
  if (own) {
    const hit = sessions.find((s) => s.providerSessionId === own)
    if (hit) return hit
  }
  const started = Date.parse(input.startedAt)
  if (!Number.isFinite(started)) return null
  const near = sessions.filter((s) => sameFolder(s.folder, input.cwd) && s.launchedAt !== null && Math.abs(s.launchedAt - started) <= 20_000)
  return near.length === 1 ? near[0]! : null
}

const contextName = (context: string | null, sb: SwitchboardView, pool: string | null): string | null => {
  if (context === 'personal') return 'personal'
  if (pool && sb.groupOrg?.[pool]) return sb.groupOrg[pool]!
  return null
}

export function sessionMeta(input: SessionMetaInput): SessionMeta {
  const sb = input.switchboard
  const record = sb?.sessions ? recordOf(input, sb.sessions) : null
  let account: SessionMeta['account'] = null
  let context: string | null = null
  if (record) {
    if (record.label) account = { label: record.label, short: shortAccount(record.label), source: 'switchboard-session' }
    context = record.contextName ?? (record.context === 'personal' ? 'personal' : null)
  } else if (sb?.folder) {
    // A console Fabric started in a group's folder runs through that group's route: its account is the route's now.
    const provider = providerOf(input.runner)
    const id = provider ? sb.routes?.[`${provider}:${sb.folder.pool}`] : undefined
    const label = id ? sb.labels?.[id] ?? null : null
    if (label) account = { label, short: shortAccount(label), source: 'group-route' }
    context = contextName(sb.folder.context, sb, sb.folder.pool)
  }
  const l = input.launch
  const started = l
    ? { by: l.by, via: l.via, at: l.startedAt, parentSessionId: l.parentSessionId }
    : record ? { by: 'switchboard', via: record.surface, at: record.launchedAt === null ? null : new Date(record.launchedAt).toISOString(), parentSessionId: null } : null
  const handedOver = record && (record.surface === 'fallback' || record.surface === 'recovery' || record.surface === 'fabric')
    ? { at: record.launchedAt === null ? null : new Date(record.launchedAt).toISOString() }
    : null
  return {
    sessionId: input.sessionId,
    runnerSessionId: l?.runnerSessionId ?? record?.providerSessionId ?? null,
    runner: input.runner,
    model: input.model,
    folder: input.cwd,
    branch: input.branch,
    account,
    context,
    started,
    handedOver
  }
}

/** A model id as a person reads it: `claude-opus-5-5` → `Opus 5.5`, a date suffix dropped; anything else as it is. */
export function modelLabel(id: string | null): string | null {
  if (!id) return null
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/.exec(id)
  if (!m) return id.length > 24 ? `${id.slice(0, 23)}…` : id
  return `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
}

/** The newest model a Claude Code transcript's tail names (`"model":"…"` of an assistant line), or null. */
export function modelFromTranscriptTail(tail: string): string | null {
  const all = [...tail.matchAll(/"model"\s*:\s*"([A-Za-z0-9._-]{3,64})"/g)]
  const last = all.at(-1)?.[1] ?? null
  return last && last !== '<synthetic>' ? last : null
}

/** Claude Code's folder name for a project: every character that is not a letter or a digit becomes `-`. */
export function claudeProjectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}
// #endregion session-meta
