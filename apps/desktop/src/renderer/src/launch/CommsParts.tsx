// #region comms-operator-reads-w4 — docs: docs/ux/screens.md#scr-81-project-comms
// The parts wave 4 adds to Comms (SCR-81's wave-4 amendment; SCN-147, SCN-156, SCN-157): who answers a request, how it
// ended, who marked a message read, the files a message names, a request's timeline, related threads, history search
// and what waits for a project. All of it READS: nothing here writes to the board, and no control promises to stop or
// settle anything (owner settlement is a later node; until it is served no settle action is shown at all).
//
// Each part holds its own rule for a read that fails: it says so where its answer would be, and never in the words of
// an empty answer — "Who answers is not known right now", never "absent"; "The outcome could not be read", never "No
// summary was given"; "Comms did not answer the search", never "No message contains these words".

import { useState } from 'react'
import type {
  CommsArtifact,
  CommsFacts,
  CommsPending,
  CommsReadError,
  CommsRelatedThread,
  CommsRequest,
  CommsResponder,
  CommsSearchHit,
  CommsTimelineStep
} from '../../../shared/commsRead.ts'
import { since } from '../duration'
import { useLocale, useT, type Translate } from '../i18n'
import { en, type StringKey } from '../i18n/en'
import { FailureNote } from '../OperatorError'
import { runnerLabel } from '../runnerLabel'

/** A machine word the contract owns, in the operator's language where this build knows it, raw where it does not. */
export const contractWord = (t: Translate, group: string, value: string): string => {
  const key = `launch.comms.${group}.${value}`
  return key in en ? t(key as StringKey) : value
}
/** "3h ago" / «3 ч назад»: how long ago, in the operator's words. */
export const ago = (t: Translate, iso: string): string => t('board.ago', { time: since(iso, t) })
/** A point in time, in the operator's locale. */
export const when = (locale: string, iso: string): string => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

/** What the screen knows about who answers: not read yet, read, or a read that failed. */
export type RespondersState = { kind: 'checking' } | { kind: 'read'; responders: CommsResponder[] } | { kind: 'unknown' }
/** The facts of the messages on screen: not read yet, read, or a read that failed. */
export type FactsState = { kind: 'reading' } | { kind: 'read'; facts: CommsFacts } | { kind: 'unavailable' }

const TERMINAL = new Set(['completed', 'failed_known', 'cancelled', 'expired'])

/** The slot that answers a request: its target project's, for its capability. */
export const slotOf = (responders: CommsResponder[], request: CommsRequest): CommsResponder | null =>
  responders.find((r) => r.project === request.target && r.capability === request.capability) ?? null

/** "Answers it": the target project's current responder for the request's capability (SCN-147 step 1). */
export function ResponderLine({ request, state, nameOf }: { request: CommsRequest; state: RespondersState; nameOf: (id: string) => string }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  let text: string
  let why: string | null = null
  if (state.kind === 'checking') text = t('launch.comms.responder.checking')
  else if (state.kind === 'unknown') text = t('launch.comms.responder.unknown')
  else {
    const slot = slotOf(state.responders, request)
    if (slot?.held) text = t('launch.comms.responder.paused')
    else if (slot?.state === 'active') {
      // The coding agent by its name (runnerLabel), never its raw runner id (2026-10-14 review UX-6).
      text = t('launch.comms.responder.active', { n: slot.generation, agent: slot.agent ? runnerLabel(slot.agent, t) : (slot.label ?? '—'), since: slot.since ? when(locale, slot.since) : '—' })
    } else if (slot?.state === 'stale') {
      text = t('launch.comms.responder.stale', { n: slot.generation, since: slot.leaseExpiresAt ? ago(t, slot.leaseExpiresAt) : '—' })
    } else if (!slot || slot.state === 'absent') {
      // No slot at all is absent too: nobody ever answered that capability for that project.
      text = t('launch.comms.responder.absent', { capability: request.capability, project: nameOf(request.target) })
      const cause = slot?.releasedCause
      if (cause && `launch.comms.responder.absentWhy.${cause}` in en) {
        why = t(`launch.comms.responder.absentWhy.${cause}` as StringKey, { since: slot?.releasedAt ? ago(t, slot.releasedAt) : '—' })
      }
    } else text = t('launch.comms.responder.unknown')
  }
  return (
    <div className="lp-comms-line" data-comms-responder={state.kind === 'read' ? (slotOf(state.responders, request)?.state ?? 'absent') : state.kind}>
      <dt>{t('launch.comms.responder.label')}</dt>
      <dd>{text}{why && <> {why}</>}</dd>
    </div>
  )
}

/** Who can settle an `outcome_unknown` request (SCN-147 step 3). Until owner settlement is served, a request whose
 *  slot no responder holds is said as nobody's — never with an action the screen does not offer. */
export function UnknownLine({ request, state }: { request: CommsRequest; state: RespondersState }): React.JSX.Element | null {
  const t = useT()
  if (request.state !== 'outcome_unknown' || state.kind !== 'read') return null
  const slot = slotOf(state.responders, request)
  const held = slot !== null && (slot.state === 'active' || slot.state === 'stale')
  return <p className="lp-meta" data-comms-unknown={held ? 'holder' : 'nobody'}>{t(held ? 'launch.comms.unknown.settledBy' : 'launch.comms.unknown.nobody', { capability: request.capability })}</p>
}

/** How a finished request ended (SCN-147 step 2): the responder's outcome, or the requester's cancel reason. */
export function OutcomeBlock({ request, facts }: { request: CommsRequest; facts: FactsState }): React.JSX.Element | null {
  const t = useT()
  if (!TERMINAL.has(request.state)) return null
  if (facts.kind === 'reading') return null
  if (facts.kind === 'unavailable') return <p className="lp-meta" role="status">{t('launch.comms.outcome.unavailable')}</p>
  const outcomes = facts.facts.requests[request.id]?.outcomes ?? []
  if (outcomes.length === 0) return <p className="lp-meta">{t('launch.comms.outcome.none')}</p>
  return (
    <div className="lp-comms-outcomes">
      {outcomes.map((o, i) => (
        <div key={`${o.at}-${i}`} data-comms-outcome={o.kind}>
          <p className="lp-meta">{t(o.kind === 'cancel_reason' ? 'launch.comms.outcome.cancelReason' : 'launch.comms.outcome.summary')}</p>
          <p>{o.summary ?? t('launch.comms.outcome.none')}</p>
          {o.evidence.length > 0 && <ArtifactList artifacts={o.evidence} />}
        </div>
      ))}
    </div>
  )
}

/** "Marked read by": the participant projects that marked a message read, never its sender; nothing when none has. */
export function ReadBy({ messageId, facts, nameOf }: { messageId: string; facts: FactsState; nameOf: (id: string) => string }): React.JSX.Element | null {
  const t = useT()
  if (facts.kind !== 'read') return null
  const readBy = facts.facts.messages[messageId]?.readBy ?? []
  if (readBy.length === 0) return null
  return <p className="lp-meta">{t('launch.comms.readBy', { projects: readBy.map(nameOf).join(', ') })}</p>
}

/** Read an artifact the board holds as it is, or null when it is not an artifact reference. */
export function artifactOf(v: unknown): CommsArtifact | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const a = v as Record<string, unknown>
  if (typeof a.id !== 'string' || typeof a.contentHash !== 'string' || !(a.label === undefined || typeof a.label === 'string')) return null
  return { id: a.id, contentHash: a.contentHash, ...(typeof a.label === 'string' ? { label: a.label } : {}) }
}

/** `sha256:` plus the first twelve hex digits: enough to tell two files apart on screen; Copy takes the whole hash. */
const shortHash = (hash: string): string => (hash.length > 19 ? `${hash.slice(0, 19)}…` : hash)
const isHttps = (url: string): boolean => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

/** The files a message (or an outcome) names, as the sender stated them (SCN-147 step 5). Only an `https:` link opens,
 *  through main; any other scheme is text that does not open. The hash is the sender's word: Fabric never checked it. */
export function ArtifactList({ artifacts }: { artifacts: CommsArtifact[] }): React.JSX.Element {
  const t = useT()
  const [note, setNote] = useState<{ id: string; text: string } | null>(null)
  const copy = async (a: CommsArtifact): Promise<void> => {
    try {
      await navigator.clipboard.writeText(a.contentHash)
      setNote({ id: a.id, text: t('launch.comms.artifact.copied') })
    } catch {
      // The clipboard refused: said, never a silent nothing (2026-10-14 review UX-7).
      setNote({ id: a.id, text: t('launch.comms.artifact.copyFailed') })
    }
  }
  const open = async (a: CommsArtifact): Promise<void> => {
    let reply: Awaited<ReturnType<typeof window.fabric.comms.openArtifact>>
    try {
      reply = await window.fabric.comms.openArtifact(a.id)
    } catch {
      reply = { ok: false, reason: 'failed' }
    }
    setNote(reply.ok ? null : { id: a.id, text: t(reply.reason === 'refused' ? 'launch.comms.artifact.notOpened' : 'launch.comms.artifact.openFailed') })
  }
  return (
    <ul className="lp-comms-artifacts">
      {artifacts.map((a) => {
        const name = a.label ?? a.id
        return (
          <li key={`${a.id}-${a.contentHash}`} data-comms-artifact={isHttps(a.id) ? 'link' : 'text'}>
            {isHttps(a.id) ? (
              <button type="button" className="lp-link" onClick={() => void open(a)}>{name}</button>
            ) : (
              <span>{name}</span>
            )}
            <span className="lp-meta"> {t('launch.comms.artifact.hash', { hash: shortHash(a.contentHash) })}</span>
            <button type="button" className="lp-button" onClick={() => void copy(a)}>{t('launch.comms.artifact.copy')}</button>
            {!isHttps(a.id) && <span className="lp-meta"> {t('launch.comms.artifact.notOpened')}</span>}
            {note?.id === a.id && <span className="lp-meta" role="status"> {note.text}</span>}
          </li>
        )
      })}
    </ul>
  )
}

type Loaded<T> = { kind: 'closed' } | { kind: 'loading' } | { kind: 'read'; value: T } | { kind: 'unavailable'; error: CommsReadError }

/** "What happened to this request" (SCN-147 step 7): the journal's steps, oldest first, read when opened. */
export function Timeline({ requestId }: { requestId: string }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [state, setState] = useState<Loaded<{ steps: CommsTimelineStep[]; more: boolean }>>({ kind: 'closed' })
  const toggle = async (): Promise<void> => {
    if (state.kind !== 'closed') { setState({ kind: 'closed' }); return }
    setState({ kind: 'loading' })
    let reply: Awaited<ReturnType<typeof window.fabric.comms.timeline>>
    try {
      reply = await window.fabric.comms.timeline(requestId)
    } catch (e) {
      reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
    }
    setState(reply.ok ? { kind: 'read', value: { steps: reply.steps, more: reply.more } } : { kind: 'unavailable', error: reply.error })
  }
  const stepText = (s: CommsTimelineStep): string => {
    const at = when(locale, s.at)
    const from = contractWord(t, 'request.state', s.from)
    const to = contractWord(t, 'request.state', s.to)
    const cause = s.cause ? contractWord(t, 'cause', s.cause) : '—'
    return typeof s.generation === 'number' ? t('launch.comms.timeline.step', { at, from, to, cause, n: s.generation }) : t('launch.comms.timeline.stepPlain', { at, from, to, cause })
  }
  return (
    <div className="lp-comms-disclosure">
      <button type="button" className="lp-button" aria-expanded={state.kind !== 'closed'} onClick={() => void toggle()}>{t('launch.comms.timeline.title')}</button>
      {state.kind === 'loading' && <p className="lp-meta">{t('launch.comms.reading')}</p>}
      {state.kind === 'unavailable' && <p className="lp-meta" role="status">{t('launch.comms.unavailable')}</p>}
      {state.kind === 'read' && state.value.steps.length === 0 && <p className="lp-meta">{t('launch.comms.timeline.empty')}</p>}
      {state.kind === 'read' && state.value.steps.length > 0 && (
        <ol className="lp-comms-steps">
          {state.value.steps.map((s, i) => <li key={`${s.at}-${i}`}>{stepText(s)}</li>)}
        </ol>
      )}
      {state.kind === 'read' && state.value.more && <p className="lp-meta">{t('launch.comms.timeline.more')}</p>}
    </div>
  )
}

/** "Related threads" (SCN-147 step 7): between the same projects, or carrying the same stated file. */
export function RelatedThreads({ threadId, onOpen }: { threadId: string; onOpen: (thread: CommsRelatedThread) => void }): React.JSX.Element {
  const t = useT()
  const [state, setState] = useState<Loaded<CommsRelatedThread[]>>({ kind: 'closed' })
  const toggle = async (): Promise<void> => {
    if (state.kind !== 'closed') { setState({ kind: 'closed' }); return }
    setState({ kind: 'loading' })
    let reply: Awaited<ReturnType<typeof window.fabric.comms.related>>
    try {
      reply = await window.fabric.comms.related(threadId)
    } catch (e) {
      reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
    }
    setState(reply.ok ? { kind: 'read', value: reply.threads } : { kind: 'unavailable', error: reply.error })
  }
  return (
    <div className="lp-comms-disclosure">
      <button type="button" className="lp-button" aria-expanded={state.kind !== 'closed'} onClick={() => void toggle()}>{t('launch.comms.related.title')}</button>
      {state.kind === 'loading' && <p className="lp-meta">{t('launch.comms.reading')}</p>}
      {state.kind === 'unavailable' && <p className="lp-meta" role="status">{t('launch.comms.unavailable')}</p>}
      {state.kind === 'read' && state.value.length === 0 && <p className="lp-meta">{t('launch.comms.related.empty')}</p>}
      {state.kind === 'read' && state.value.length > 0 && (
        <ul className="lp-comms-related">
          {state.value.map((r) => (
            <li key={r.id}>
              <button type="button" className="lp-link" onClick={() => onOpen(r)}>{r.subject ?? t('launch.comms.untitled', { id: r.id.slice(0, 8) + '…' })}</button>
              <span className="lp-meta"> · {t(r.why === 'shared-artifact' ? 'launch.comms.related.shared-artifact' : 'launch.comms.related.same-projects')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: string }
  /** `failed` holds the machine's words when the last page of more results did not come: `more` and `before` stay, so
   *  "More results" asks the same page again (2026-10-14 review UX-7, ER-8). */
  | { kind: 'results'; query: string; hits: CommsSearchHit[]; more: boolean; stoppedEarly: boolean; before: number | null; busy: boolean; failed: string | null }
  | { kind: 'unavailable'; query: string; detail: string }

/** "Search messages" (SCN-156): newest first, at most 50 a page; opening a hit opens its thread at that message. */
export function SearchPanel({ nameOf, onOpen }: { nameOf: (id: string) => string; onOpen: (hit: CommsSearchHit) => void }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const run = async (q: string, before: number | null, prior: CommsSearchHit[]): Promise<void> => {
    let reply: Awaited<ReturnType<typeof window.fabric.comms.search>>
    try {
      reply = await window.fabric.comms.search(q, before)
    } catch (e) {
      reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
    }
    if (!reply.ok) {
      // A failed page of more results keeps what was found AND the way to the rest: it is never read as the end of the
      // results. A failed first search says Comms did not answer — never "no message contains these words".
      const failed = reply.error.message
      setState(before !== null ? { kind: 'results', query: q, hits: prior, more: true, stoppedEarly: false, before, busy: false, failed } : { kind: 'unavailable', query: q, detail: failed })
      return
    }
    setState({ kind: 'results', query: q, hits: [...prior, ...reply.hits], more: reply.more, stoppedEarly: reply.stoppedEarly, before: reply.before, busy: false, failed: null })
  }
  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const q = query.trim()
    if ([...q].length < 2) { setTooShort(true); return }
    setTooShort(false)
    setState({ kind: 'searching', query: q })
    void run(q, null, [])
  }
  return (
    <section className="lp-comms-search" aria-label={t('launch.comms.search.label')}>
      <form className="lp-filters" role="search" onSubmit={submit}>
        <label>
          {t('launch.comms.search.label')}
          <input type="search" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="submit" className="lp-button">{t('launch.comms.search.submit')}</button>
        {state.kind !== 'idle' && (
          <button type="button" className="lp-button" onClick={() => { setState({ kind: 'idle' }); setQuery(''); setTooShort(false) }}>{t('launch.comms.search.clear')}</button>
        )}
      </form>
      {tooShort && <p className="lp-meta" role="status">{t('launch.comms.search.tooShort')}</p>}
      {state.kind === 'searching' && <p className="lp-meta" role="status">{t('launch.comms.search.searching')}</p>}
      {state.kind === 'unavailable' && <FailureNote role="status" said={t('launch.comms.search.unavailable')} detail={state.detail} />}
      {state.kind === 'results' && state.hits.length === 0 && !state.stoppedEarly && <p className="lp-meta" role="status">{t('launch.comms.search.none')}</p>}
      {state.kind === 'results' && state.stoppedEarly && <p className="lp-meta" role="status">{t('launch.comms.search.stoppedEarly')}</p>}
      {state.kind === 'results' && state.hits.length > 0 && (
        <ul className="lp-comms-hits">
          {state.hits.map((h) => (
            <li key={h.message}>
              <button type="button" className="lp-link" onClick={() => onOpen(h)}>{h.snippet}</button>
              <span className="lp-meta"> · {nameOf(h.sender)} · {when(locale, h.at)}</span>
            </li>
          ))}
        </ul>
      )}
      {state.kind === 'results' && state.failed !== null && <FailureNote role="status" said={t('launch.comms.search.moreFailed')} detail={state.failed} />}
      {state.kind === 'results' && state.more && (
        <div className="lp-actions">
          <button type="button" className="lp-button" disabled={state.busy}
            onClick={() => { setState({ ...state, busy: true }); void run(state.query, state.before, state.hits) }}>{t('launch.comms.search.more')}</button>
        </div>
      )}
    </section>
  )
}

/** What the pending panel shows: not read yet, the rows with when they were confirmed, or never read. */
export type PendingState = { kind: 'reading' } | { kind: 'read'; projects: CommsPending[]; more: boolean; stale: boolean } | { kind: 'unavailable' }

/** "Waiting for a project" (SCN-157, COM-05): per project, what was delivered, the board holds and none of its agents
 *  marked read. Collapsed, and said, when nothing waits; opening a row narrows the list to that project. */
export function PendingPanel({ state, nameOf, onProject, confirmedAt }: { state: PendingState; nameOf: (id: string) => string; onProject: (project: string) => void; confirmedAt: string | null }): React.JSX.Element | null {
  const t = useT()
  const [open, setOpen] = useState(true)
  if (state.kind === 'reading') return null
  if (state.kind === 'unavailable') return <p className="lp-meta" role="status">{t('launch.comms.pending.unavailable')}</p>
  if (state.projects.length === 0) return <p className="lp-meta">{t('launch.comms.pending.none')}</p>
  return (
    <section className="lp-comms-pending" aria-label={t('launch.comms.pending.title')}>
      <button type="button" className="lp-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{t('launch.comms.pending.title')}</button>
      {state.stale && confirmedAt && <p className="lp-meta" role="status">{t('launch.comms.pollFailed', { time: confirmedAt })}</p>}
      {/* The board answers at most 100 projects and says when it holds more: past that the list is never the whole
          (2026-10-14 review ER-9). */}
      {state.more && <p className="lp-meta" role="status">{t('launch.comms.pending.capped', { count: state.projects.length })}</p>}
      {open && (
        <ul>
          {state.projects.map((p) => (
            <li key={p.project}>
              {/* Review i1 UX-6: `requests` counts the project's UNREAD requests, `requestsWithAbsentResponder` every open
                  request nobody answers, read or not (0.3.9 BD-2), and `oldestAt` is the older of the two. A project
                  listed only for a read request it has not answered comes with unread 0 and requests 0, so it is said
                  as nothing unread, with how long the oldest waits, and the requests line is its own count, never
                  "of them". */}
              <button type="button" className="lp-link" onClick={() => onProject(p.project)}>
                {p.unread > 0
                  ? t('launch.comms.pending.row', { project: nameOf(p.project), count: p.unread, age: since(p.oldestAt, t), findings: p.findings, requests: p.requests })
                  : t('launch.comms.pending.rowNoUnread', { project: nameOf(p.project), age: since(p.oldestAt, t) })}
              </button>
              {p.requestsWithAbsentResponder > 0 && <span className="lp-meta"> · {t('launch.comms.pending.noResponder', { count: p.requestsWithAbsentResponder })}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
// #endregion comms-operator-reads-w4
