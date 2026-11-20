// #region behaviour-journal — docs: docs/adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md#decision
/**
 * The agents' behaviour journal (ADR-0203 §6; the owner, 2026-11-20, package D: who did what on whose word, the
 * decisions and the approvals, tied to the voice's call journal). One JSONL file a UTC day in `userData/ceo/behaviour/`
 * (folder 0700, files 0600), one line an act: the actor, the act, its target, whose word it was done on (the owner by
 * voice, naming the call; the CEO; the approval mode; an owner's grant; the agent's own ask) and what was decided.
 * Free text (a reason) is redacted and cut; a line is never more than 4 KB. Kept 30 days.
 *
 * Written from two processes (the window's CEO tools and the board's floor), so every line is one append; a line that
 * cannot be written is counted by the host and never thrown into the act it describes.
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, lstatSync } from 'node:fs'
import path from 'node:path'
import { redact, redactPayload } from '../shared/redact.ts'

export const BEHAVIOUR_FOLDER = 'behaviour'
export const BEHAVIOUR_KEEP_DAYS = 30
const LINE_BYTES = 4096
const REASON_CHARS = 300
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/

export type WordOf = 'owner' | 'ceo' | 'approval-mode' | 'agent' | 'board'

export interface BehaviourEntry {
  t: string
  actor: { kind: 'ceo' | 'voice' | 'session' | 'system'; id: string }
  /** What was done: `session.start`, `effect.publication`, … */
  act: string
  target?: string | null
  /** On whose word: `via` is the door (voice, console, grant, a mode's name, request), `ref` names the call or grant. */
  word: { of: WordOf; via: string; ref?: string | null }
  decision: 'done' | 'refused' | 'failed' | 'allowed' | 'waits-for-owner'
  reason?: string | null
}

export interface BehaviourJournalDeps {
  /** `userData/ceo`. */
  folder: string
  now?: () => number
  failed?: (what: string, e: unknown) => void
}

export function createBehaviourJournal(deps: BehaviourJournalDeps) {
  const now = deps.now ?? Date.now
  const dir = path.join(deps.folder, BEHAVIOUR_FOLDER)
  let prunedFor = ''

  function usable(): boolean {
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      // A link in place of the folder is not followed: the journal would land wherever it points.
      return !lstatSync(dir).isSymbolicLink()
    } catch (e) { /* counted by the host (ops.failed), never thrown into the act */ deps.failed?.('folder', e); return false }
  }

  function days(): string[] {
    try { return readdirSync(dir).filter((f) => DAY_FILE.test(f)).sort() } catch (e) { /* counted by the host (ops.failed), never thrown into the act */ deps.failed?.('list', e); return [] }
  }

  /** Remove day files older than the window; by the file's own name, never its time stamp. */
  function prune(): number {
    const cutoff = new Date(now() - BEHAVIOUR_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
    let n = 0
    for (const f of days()) {
      if (f.slice(0, 10) >= cutoff) continue
      try { rmSync(path.join(dir, f)); n++ } catch (e) { /* counted by the host (ops.failed), never thrown into the act */ deps.failed?.('prune', e) }
    }
    return n
  }

  function note(entry: Omit<BehaviourEntry, 't'>): boolean {
    const t = new Date(now()).toISOString()
    if (!usable()) return false
    const day = t.slice(0, 10)
    if (prunedFor !== day) { prunedFor = day; prune() }
    const reason = entry.reason == null ? null : redact(String(entry.reason)).text.slice(0, REASON_CHARS)
    const clean = redactPayload({ ...entry, reason } as unknown as Record<string, unknown>).payload
    let line = JSON.stringify({ t, ...clean }) + '\n'
    if (Buffer.byteLength(line) > LINE_BYTES) line = JSON.stringify({ t, actor: entry.actor, act: entry.act, word: entry.word, decision: entry.decision, cut: true }) + '\n'
    try { appendFileSync(path.join(dir, `${day}.jsonl`), line, { mode: 0o600 }); return true } catch (e) { /* counted by the host (ops.failed), never thrown into the act */ deps.failed?.('write', e); return false }
  }

  /** The newest entries first, from the last `daysBack` days, optionally only those of one voice call. */
  function read(q: { daysBack?: number; call?: string | null; limit?: number } = {}): { entries: BehaviourEntry[]; unreadable: number } {
    const limit = Math.max(1, Math.min(q.limit ?? 50, 500))
    const from = new Date(now() - Math.max(1, Math.min(q.daysBack ?? 1, BEHAVIOUR_KEEP_DAYS)) * 86_400_000).toISOString().slice(0, 10)
    const out: BehaviourEntry[] = []
    let unreadable = 0
    for (const f of days().reverse()) {
      if (f.slice(0, 10) < from) break
      let text = ''
      try { text = readFileSync(path.join(dir, f), 'utf8') } catch (e) { /* counted by the host (ops.failed), never thrown into the act */ deps.failed?.('read', e); unreadable++; continue }
      const lines = text.split('\n').filter(Boolean).reverse()
      for (const l of lines) {
        let e: BehaviourEntry
        try { e = JSON.parse(l) as BehaviourEntry } catch { /* a torn line from a crash mid-write: counted, never shown as an act */ unreadable++; continue }
        if (q.call && e.word?.ref !== q.call) continue
        out.push(e)
        if (out.length >= limit) return { entries: out, unreadable }
      }
    }
    return { entries: out, unreadable }
  }

  return { note, read, prune, folder: dir }
}

export type BehaviourJournal = ReturnType<typeof createBehaviourJournal>
// #endregion behaviour-journal
