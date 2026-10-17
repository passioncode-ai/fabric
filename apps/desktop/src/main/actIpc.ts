// What crosses the bridge for История: a query read defensively (it is the renderer's, so unknown) and an answer
// that never carries an outcome's internals. Pure.
import { ACT_CATEGORIES, type ActActor, type ActAnswer, type ActCategory, type ActHistoryQuery } from '../shared/acts.ts'
import type { ActResult } from './acts.ts'

const KINDS: readonly ActActor['kind'][] = ['person', 'agent', 'system']

export function actQueryOf(raw: unknown): ActHistoryQuery {
  const q = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: ActHistoryQuery = {}
  if (typeof q.limit === 'number' && Number.isFinite(q.limit)) out.limit = Math.max(1, Math.min(100, Math.floor(q.limit)))
  if (typeof q.before === 'number' && Number.isSafeInteger(q.before) && q.before > 0) out.before = q.before
  if (typeof q.actorKind === 'string' && (KINDS as readonly string[]).includes(q.actorKind)) out.actorKind = q.actorKind as ActActor['kind']
  if (typeof q.projectId === 'string' && /^[0-9a-f-]{36}$/i.test(q.projectId)) out.projectId = q.projectId.toLowerCase()
  if (typeof q.category === 'string' && (ACT_CATEGORIES as readonly string[]).includes(q.category)) out.category = q.category as ActCategory
  if (typeof q.text === 'string' && q.text.trim()) out.text = q.text.trim().slice(0, 100)
  return out
}

export function answerOf(r: ActResult): ActAnswer {
  return r.ok ? { ok: true, seq: r.seq } : { ok: false, reason: r.reason, ...(r.says ? { says: r.says } : {}) }
}
