// #region people-ask-run — docs: docs/evidence/specs/2026-11-16-people-ask-bridge.md#4-the-pass
/**
 * The people-ask bridge's pass (task 11ebbf83; the operator, 2026-11-16). Beside the board dispatcher, one pass at a
 * time: each «Нужны вы» row becomes one `people.ask` request to its organization's PM project (`shared/peopleAsk.ts`);
 * the PM agent's reply carries the person's answer from Telegram, which is judged, applied once through the SAME door the
 * window's button calls (`createPeopleApply`, wired in index.ts to `callDoor`), and said in the thread as «решено» or
 * «не применено: <причина>». A row decided elsewhere, or the switch turned off, takes its request back (`com.cancel`).
 *
 * Bounded: one reading of «Нужны вы», at most `MAX_WATCHED` threads and `MAX_SUBMITS` new requests a pass. A read that
 * fails or is partial cancels nothing and applies nothing it cannot confirm open; every failure goes to the operations
 * log and never ends other work. What was asked and decided is kept in `userData/people-asks.json`, so a restart never
 * asks twice or decides twice.
 */
import { createHash } from 'node:crypto'
import type { BoardEntry } from '../shared/board.ts'
import type { CommsMessage } from '../shared/commsRead.ts'
import {
  DELEGATE_ANSWER, DELEGATE_OPTION, PEOPLE_ASK_CAPABILITY, askBody, askKey, autoRouteOf, decisionOf, hasAnswerBlock, itemOf, judgeAnswer, parseAnswer, prepareAsk, resultText, routeOf,
  type AskAct, type AskKind, type PeopleAnswer, type PeopleAsk, type PeopleRoute
} from '../shared/peopleAsk.ts'

/** How often the bridge runs beside the dispatcher. */
export const PEOPLE_ASK_WATCH_MS = 45_000
export const MAX_SUBMITS = 10
export const MAX_WATCHED = 100
/** A decided or withdrawn request's thread is still read this long, so a late answer is told it decides nothing. */
export const WATCH_CLOSED_MS = 2 * 3600_000
/** A refused submit is tried again after this. */
export const RETRY_UNSENT_MS = 3600_000
/** How many requests one item gets at one revision: the board ending one with no decision asks once more (task 5f23ea40). */
export const ASK_ATTEMPTS = 2
/** The board's request states that end a request; one that ends with nothing applied here ended without a decision. */
const ENDED = new Set(['expired', 'cancelled', 'completed', 'failed_known'])
const KEEP_CLOSED_MS = 30 * 24 * 3600_000
const MAX_RECORDS = 2000

type Decision = ReturnType<typeof decisionOf>
export interface Decided { option: string | null; text: string | null; words: string; answerId: string; decision: Decision }
export type ApplyOutcome = { ok: true } | { ok: false; reason: string }

export interface AskRecord {
  item: string
  revision: number
  kind: AskKind
  /** The Project the request was sent as (the item's own), and the PM Project it was sent to. */
  sender: string
  target: string
  organization: string
  ask: PeopleAsk
  act: AskAct
  state: 'unsent' | 'open' | 'applied' | 'cancelled' | 'closed'
  requestId: string | null
  thread: string | null
  askedAt: number
  /** Which request this is for the item at its revision: absent is the first (`ASK_ATTEMPTS`). */
  attempt?: number
  /** The board ended the request (expired, cancelled, completed or failed by the PM side) with nothing applied here. */
  endedUndecided?: boolean
  closedAt?: number
  retryAt?: number
  /** Each answer judged, by its message id, with the result said in the thread and whether that was posted. */
  handled: Record<string, { result: string; posted: boolean }>
  /** The answer whose decision is being applied (written before the door is called). */
  applying?: string
  decided?: { message: string; option: string | null; text: string | null; words: string; voice: boolean; decider: PeopleAnswer['decider']; at: string }
}

export function isAskRecord(v: unknown): v is AskRecord {
  const r = v as Partial<AskRecord> | null
  return !!r && typeof r === 'object' && typeof r.item === 'string' && typeof r.revision === 'number' && typeof r.sender === 'string'
    && typeof r.target === 'string' && !!r.ask && typeof r.ask === 'object' && !!r.act && typeof r.act === 'object'
    && ['unsent', 'open', 'applied', 'cancelled', 'closed'].includes(r.state as string) && typeof r.askedAt === 'number'
    && !!r.handled && typeof r.handled === 'object'
}

export interface ProjectFacts { id: string; name: string; business: string | null; owner: string | null }
export interface ResponderLike { project: string; capability: string; state: string; held?: boolean; leaseExpiresAt?: string }

export interface PeopleAskDeps {
  now(): number
  switchOn(): boolean
  quitting(): boolean
  /** «Нужны вы» whole, as Главная reads it (`board.query`, personOnly); `complete` false when a source was not read. */
  readItems(): Promise<{ items: BoardEntry[]; complete: boolean }>
  /** The project a row is asked for (an access request by the project it names), with its routing facts; null: none. */
  projectOf(entry: BoardEntry): Promise<ProjectFacts | null>
  /** One project's routing facts by id (a PM project found by its live responder); null when it is not known. */
  projectFacts(projectId: string): Promise<ProjectFacts | null>
  /** The routes this machine holds (`userData/people-ask-routes.json`, else `DEFAULT_PEOPLE_ROUTES`). */
  routes(): readonly PeopleRoute[]
  /** Whether Fabric may allow this access request on relayed words (`relayedAccess.ts#admitAccessAct`). */
  allowAccess(requestId: string): Promise<boolean>
  responders(): Promise<ResponderLike[]>
  epoch(project: string): Promise<number | null>
  submit(project: string, input: Record<string, unknown>): Promise<Record<string, unknown>>
  reply(project: string, input: Record<string, unknown>): Promise<Record<string, unknown>>
  cancel(project: string, input: Record<string, unknown>): Promise<Record<string, unknown>>
  /** One thread's messages, oldest first (bounded by the caller). */
  thread(threadId: string): Promise<CommsMessage[]>
  apply(act: AskAct, decided: Decided): Promise<ApplyOutcome>
  load(): unknown
  save(records: AskRecord[]): void
  log(op: string, outcome: 'ok' | 'failed', detail: Record<string, unknown>): void
}

const errorOf = (r: Record<string, unknown> | null | undefined): string | null => {
  const e = r?.error as { code?: unknown } | undefined
  return e ? (typeof e.code === 'string' ? e.code : 'refused') : null
}
const noteOf = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/(^|\s)(?:~|\/)[^\s]*/g, '$1<path>').slice(0, 200)

export function createPeopleAskBridge(deps: PeopleAskDeps): { onPass(): Promise<void>; records(): AskRecord[] } {
  let records: AskRecord[] | null = null
  let busy = false
  let lastSkipped = ''
  const load = (): AskRecord[] => {
    if (records) return records
    try {
      const raw = deps.load()
      const list = Array.isArray(raw) ? raw : []
      records = list.filter(isAskRecord)
      if (records.length < list.length) deps.log('people.ask.records-unread', 'failed', { left_out: list.length - records.length })
    } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
      deps.log('people.ask.records-unread', 'failed', { note: noteOf(e) })
      records = []
    }
    return records
  }
  const save = (): void => {
    try { deps.save(load()) } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */ deps.log('people.ask.save', 'failed', { note: noteOf(e) }) }
  }

  /** Fabric's result in the thread, as the request's sender, under the answer's own key (a retry is the same message). */
  const post = async (r: AskRecord, answerId: string, text: string): Promise<boolean> => {
    try {
      const epoch = await deps.epoch(r.sender)
      if (epoch === null) return false
      const said = await deps.reply(r.sender, { idempotency: { epoch, key: `people-ask-result:${answerId}` }, replyTo: answerId, body: { format: 'text/markdown', text } })
      const refused = errorOf(said)
      if (refused) deps.log('people.ask.result', 'failed', { item: r.item, refused })
      return !refused
    } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
      deps.log('people.ask.result', 'failed', { item: r.item, note: noteOf(e) })
      return false
    }
  }
  const cancel = async (r: AskRecord, reason: string): Promise<void> => {
    if (!r.requestId) return
    try {
      const epoch = await deps.epoch(r.sender)
      if (epoch === null) throw new Error('no epoch')
      const said = await deps.cancel(r.sender, { idempotency: { epoch, key: `people-ask-cancel:${r.requestId}` }, request: r.requestId, reason })
      // A request the board already ended (answered and completed, expired) refuses the cancel; it is withdrawn either way.
      const refused = errorOf(said)
      deps.log('people.ask.cancelled', refused ? 'failed' : 'ok', { item: r.item, reason, ...(refused ? { refused } : {}) })
    } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
      deps.log('people.ask.cancelled', 'failed', { item: r.item, note: noteOf(e) })
    }
  }

  async function pass(): Promise<void> {
    const list = load()
    const now = deps.now()
    let read: { items: BoardEntry[]; complete: boolean } | null = null
    try { read = await deps.readItems() } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */ deps.log('people.ask.read', 'failed', { note: noteOf(e) }) }
    const current = new Map<string, { entry: BoardEntry; revision: number; kind: AskKind }>()
    for (const entry of read?.items ?? []) {
      const id = itemOf(entry)
      if (id) current.set(id.item, { entry, revision: id.revision, kind: id.kind })
    }
    const complete = read?.complete === true
    let dirty = false

    // 1. The answers: each reply of the PM Project to a request, judged once.
    const watched = list.filter((r) => r.requestId && r.thread && (r.state === 'open' || (r.closedAt !== undefined && now - r.closedAt < WATCH_CLOSED_MS)
      || Object.values(r.handled).some((h) => !h.posted))).slice(0, MAX_WATCHED)
    const requestState = new Map<AskRecord, string>()
    /** Records with an answer this pass could not judge yet: their request is never closed as undecided. */
    const pending = new Set<AskRecord>()
    for (const r of watched) {
      if (deps.quitting()) return
      let messages: CommsMessage[]
      try { messages = await deps.thread(r.thread!) } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
        deps.log('people.ask.thread', 'failed', { item: r.item, note: noteOf(e) })
        continue
      }
      const req = messages.find((m) => m.id === r.requestId)
      if (req?.request) requestState.set(r, req.request.state)
      const answers = messages.filter((m) => m.kind === 'reply' && m.replyTo === r.requestId && m.sender.project === r.target)
      for (const m of answers) {
        const done = r.handled[m.id]
        if (done) {
          if (!done.posted) { done.posted = await post(r, m.id, done.result); dirty = true }
          continue
        }
        const body = m.redacted || !m.body ? '' : m.body.text
        if (!hasAnswerBlock(body)) {
          // A reply with no answer block at all is the responder's note (its place is com.progress): it decides nothing and
          // Fabric posts nothing back, so the item still waits for its answer (the first live item, 2026-11-17, thread bf635f68).
          r.handled[m.id] = { result: '', posted: true }
          save()
          dirty = true
          deps.log('people.ask.note', 'ok', { item: r.item, ...(m.redacted ? { redacted: true } : {}) })
          continue
        }
        const parsed = parseAnswer(body)
        let result: { applied: true } | { applied: false; reason: string }
        if (!parsed.ok) result = { applied: false, reason: parsed.reason }
        else if (r.state === 'applied') result = { applied: false, reason: 'пункт уже решён' }
        else if (r.state !== 'open') result = { applied: false, reason: 'пункт уже решён или снят' }
        else {
          const cur = current.get(r.item)
          // A reading that could not tell whether the item is open decides nothing: the answer waits for the next pass.
          if (!cur && !complete) { pending.add(r); continue }
          const judged = judgeAnswer(r.ask, parsed.answer, cur ? { revision: cur.revision } : null)
          if (!judged.ok) result = { applied: false, reason: judged.reason }
          else {
            const a = parsed.answer
            r.applying = m.id
            save()
            let applied: ApplyOutcome
            try {
              applied = await deps.apply(r.act, { option: judged.option, text: judged.text, words: a.words, answerId: m.id,
                decision: decisionOf(r.ask, a, { project: r.target, thread: r.thread! }) })
            } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
              applied = { ok: false, reason: `кнопка Fabric отказала: ${noteOf(e)}` }
            }
            delete r.applying
            deps.log('people.ask.applied', applied.ok ? 'ok' : 'failed', { item: r.item, kind: r.kind, organization: r.organization, level: a.decider.level,
              voice: a.voice, option: judged.option, ...(applied.ok ? {} : { reason: applied.reason }) })
            if (applied.ok) {
              r.state = 'applied'
              r.closedAt = now
              r.decided = { message: m.id, option: judged.option, text: judged.text, words: a.words, voice: a.voice, decider: a.decider, at: a.at }
              result = { applied: true }
            } else result = { applied: false, reason: applied.reason }
          }
        }
        const text = resultText({ item: r.item, revision: r.revision, ...result })
        r.handled[m.id] = { result: text, posted: false }
        save()
        r.handled[m.id].posted = await post(r, m.id, text)
        dirty = true
      }
    }

    // 2. Requests whose item was decided elsewhere, changed, ended on the board, or whose switch was turned off.
    const on = deps.switchOn()
    for (const r of list) {
      if (deps.quitting()) return
      if (r.state === 'unsent' && complete && (!on || current.get(r.item)?.revision !== r.revision)) {
        r.state = 'closed'
        r.closedAt = now
        dirty = true
        continue
      }
      if (r.state !== 'open') continue
      const st = requestState.get(r)
      if (st && ENDED.has(st) && !pending.has(r)) {
        // The board ended it and nothing was applied here (an applied record is no longer open): the PM side completed or
        // failed it without the person's answer, or it expired. Step 3 asks once more while the item stays open
        // (task 5f23ea40: review:09160077 waited, its request closed failed_known, 2026-11-17).
        r.state = 'closed'
        r.closedAt = now
        r.endedUndecided = true
        dirty = true
        deps.log('people.ask.ended', 'ok', { item: r.item, kind: r.kind, organization: r.organization, request_state: st, attempt: r.attempt ?? 1 })
        continue
      }
      const cur = current.get(r.item)
      const reason = !on ? 'присылать вопросы в Telegram выключено'
        : complete && !cur ? 'решено в другом месте'
          : complete && cur && cur.revision !== r.revision ? 'пункт изменился, вопрос задан заново'
            : null
      if (!reason) continue
      // A request already completed or failed needs no cancel: it is closed as it stands.
      if (st !== 'completed' && st !== 'failed_known') await cancel(r, reason)
      r.state = 'cancelled'
      r.closedAt = now
      dirty = true
    }

    // 3. New requests for rows no request covers at their revision.
    if (on && read && !deps.quitting()) {
      let slots: ResponderLike[] | null = null
      let slotsFailed = false
      const readSlots = async (): Promise<ResponderLike[]> => {
        if (!slots && !slotsFailed) {
          try { slots = await deps.responders() } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */ slotsFailed = true; deps.log('people.ask.responders', 'failed', { note: noteOf(e) }) }
        }
        return slots ?? []
      }
      const liveSlot = (x: ResponderLike): boolean => x.capability === PEOPLE_ASK_CAPABILITY && x.state === 'active' && x.held !== true
        && (!x.leaseExpiresAt || Date.parse(x.leaseExpiresAt) > now)
      const live = async (project: string): Promise<boolean> => (await readSlots()).some((x) => x.project === project && liveSlot(x))
      /** The projects that hold a live people.ask responder, with their routing facts: read once a pass, at most 20. */
      let candidates: ProjectFacts[] | null = null
      const pmCandidates = async (): Promise<ProjectFacts[]> => {
        if (candidates) return candidates
        const ids = [...new Set((await readSlots()).filter(liveSlot).map((x) => x.project))].slice(0, 20)
        candidates = []
        for (const id of ids) {
          try { const f = await deps.projectFacts(id); if (f) candidates.push(f) } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */ deps.log('people.ask.project', 'failed', { project: id, note: noteOf(e) }) }
        }
        return candidates
      }
      const skipped: Record<string, number> = {}
      const skip = (why: string): void => { skipped[why] = (skipped[why] ?? 0) + 1 }
      let sent = 0
      const routes = deps.routes()
      for (const [item, cur] of current) {
        if (deps.quitting()) return
        if (sent >= MAX_SUBMITS) { skip('pass-bound'); continue }
        const existing = list.find((r) => r.item === item && r.revision === cur.revision)
        const again = existing?.state === 'closed' && existing.endedUndecided === true && (existing.attempt ?? 1) < ASK_ATTEMPTS
        if (existing && !again && !(existing.state === 'unsent' && now >= (existing.retryAt ?? 0))) continue
        const attempt = again ? (existing!.attempt ?? 1) + 1 : existing?.attempt ?? 1
        let project: ProjectFacts | null
        try { project = await deps.projectOf(cur.entry) } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */ skip('project-unread'); deps.log('people.ask.project', 'failed', { item, note: noteOf(e) }); continue }
        if (!project) { skip('no-project'); continue }
        let route = routeOf(project, routes)
        if (!route) {
          // No route names it: the one PM project with a live responder whose business or owner is the project's.
          const auto = autoRouteOf(project, await pmCandidates())
          if ('why' in auto) { skip(slotsFailed ? 'responders-unread' : auto.why === 'ambiguous' ? 'ambiguous-pm' : 'no-route'); continue }
          route = auto.route
        }
        if (route.target === project.id) { skip('own-pm-project'); continue }
        if (!(await live(route.target))) { skip(slotsFailed ? 'responders-unread' : `no-responder:${route.organization}`); continue }
        let allowAccess = false
        if (cur.kind === 'access' && cur.entry.access) {
          try { allowAccess = await deps.allowAccess(cur.entry.access.requestId) } catch { /* said through deps.log (the operations log) or as the refusal it returns */ allowAccess = false }
        }
        const prepared = prepareAsk(cur.entry, { projectId: project.id, projectName: project.name, now, allowAccess })
        if (!prepared) { skip('not-askable'); continue }
        const { ask, act } = prepared
        const base: AskRecord = { item, revision: cur.revision, kind: cur.kind, sender: project.id, target: route.target, organization: route.organization,
          ask, act, state: 'unsent', requestId: null, thread: null, askedAt: now, handled: existing?.handled ?? {}, ...(attempt > 1 ? { attempt } : {}) }
        let refused: string | null = null
        let receipt: Record<string, unknown> = {}
        try {
          const epoch = await deps.epoch(project.id)
          if (epoch === null) refused = 'no-epoch'
          else {
            receipt = await deps.submit(project.id, {
              idempotency: { epoch, key: askKey(item, cur.revision, attempt) },
              thread: { new: { participants: [route.target], subject: [...`${attempt > 1 ? 'Нужны вы, ещё раз' : 'Нужны вы'}: ${ask.text}`].slice(0, 200).join('') } },
              kind: 'request',
              body: { format: 'text/markdown', text: askBody(ask) },
              request: { target: route.target, capability: PEOPLE_ASK_CAPABILITY, deadline: ask.deadline }
            })
            refused = errorOf(receipt)
          }
        } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
          refused = noteOf(e)
        }
        sent++
        const requestId = String((receipt.request as { id?: unknown } | undefined)?.id ?? receipt.message ?? '')
        const thread = typeof receipt.thread === 'string' ? receipt.thread : ''
        const record: AskRecord = refused || !requestId || !thread
          ? { ...base, retryAt: now + RETRY_UNSENT_MS }
          : { ...base, state: 'open', requestId, thread }
        deps.log('people.ask.submitted', record.state === 'open' ? 'ok' : 'failed', { item, kind: cur.kind, organization: route.organization, attempt,
          ...(record.state === 'open' ? { request: requestId } : { refused: refused ?? 'no-request-id' }) })
        if (existing) list.splice(list.indexOf(existing), 1, record)
        else list.push(record)
        dirty = true
      }
      // What was not asked, counted by why, said once each time the count changes (never every pass).
      const said = JSON.stringify(skipped)
      if (said !== lastSkipped) {
        lastSkipped = said
        if (Object.keys(skipped).length) deps.log('people.ask.skipped', 'ok', { skipped })
      }
    }

    // Closed records are kept a month (at most MAX_RECORDS), so a restart never asks again what was decided.
    const kept = list.filter((r) => r.state === 'open' || r.state === 'unsent' || r.closedAt === undefined || now - r.closedAt < KEEP_CLOSED_MS)
    const trimmed = kept.length > MAX_RECORDS ? kept.slice(kept.length - MAX_RECORDS) : kept
    if (trimmed.length !== list.length) { records = trimmed; dirty = true }
    if (dirty) save()
  }

  return {
    async onPass() {
      if (busy || deps.quitting()) return
      busy = true
      try { await pass() } catch (e) {
        // A pass that throws ends this pass only; the next one starts from the records it kept.
        deps.log('people.ask.pass', 'failed', { note: noteOf(e) })
      } finally { busy = false }
    },
    records: () => load()
  }
}

/** A stable command id for one answer (a UUID, version-4 shaped), so a retry after a crash is the same command. */
export function commandIdOf(answerId: string): string {
  const h = createHash('sha256').update(`people-ask:${answerId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** The window's doors, as index.ts wires them to `callDoor` and the hub's access service. */
export interface PeopleDoors {
  answerQuestion(input: { commandId: string; questionId: string; projectId: string; expectedRevision: number; answer: string; chosenOption?: string;
    options: Array<{ id: string; label: string; consequence?: string }> }): Promise<{ committed: boolean; reason?: string }>
  decideReview(taskId: string, decision: 'accept' | 'return' | 'cancel', comment: string): Promise<{ ok: boolean; reason?: string }>
  decideProposal(id: string, decision: 'accepted' | 'declined'): Promise<{ ok: boolean; rejection?: { says?: string } | null }>
  grant(projectId: string | null, floorClass: string, target: string): Promise<unknown>
  admitAccess(verb: 'allow' | 'deny', requestId: string): Promise<{ ok: true } | { ok: false; message: string }>
  decideAccess(requestId: string, verdict: 'allowed' | 'denied', relayed: Decision): Promise<{ ok: boolean; reason?: string }>
}

const refusedBy = (reason: unknown): ApplyOutcome => ({ ok: false, reason: `кнопка Fabric отказала: ${String(reason ?? 'без причины').slice(0, 300)}` })

/** An accepted answer applied through the door the window's button calls for that kind of row. */
export function createPeopleApply(doors: PeopleDoors): (act: AskAct, d: Decided) => Promise<ApplyOutcome> {
  return async (act, d) => {
    try {
      if (act.kind === 'question') {
        const delegate = d.option === DELEGATE_OPTION
        const r = await doors.answerQuestion({ commandId: commandIdOf(d.answerId), questionId: act.questionId, projectId: act.projectId,
          expectedRevision: act.revision, answer: delegate ? DELEGATE_ANSWER : d.words,
          ...(delegate || d.option === null ? {} : { chosenOption: d.option }), options: act.options })
        return r.committed ? { ok: true } : refusedBy(r.reason)
      }
      if (act.kind === 'review') {
        const decision = d.option === 'accept' || d.option === 'cancel' ? d.option : 'return'
        const r = await doors.decideReview(act.taskId, decision, d.option === null ? (d.text ?? d.words) : d.words)
        return r.ok ? { ok: true } : refusedBy(r.reason)
      }
      if (act.kind === 'proposal') {
        const r = await doors.decideProposal(act.proposalId, d.option === 'accept' ? 'accepted' : 'declined')
        return r.ok ? { ok: true } : refusedBy(r.rejection?.says)
      }
      if (act.kind === 'effect') {
        if (d.option !== 'allow') return { ok: false, reason: 'для этого пункта нужно выбрать вариант' }
        await doors.grant(act.projectId, act.floorClass, act.target)
        return { ok: true }
      }
      const verb = d.option === 'allow' ? 'allow' : 'deny'
      const admitted = await doors.admitAccess(verb, act.requestId)
      if (!admitted.ok) return { ok: false, reason: `разрешить это можно только в окне Fabric: ${admitted.message.slice(0, 300)}` }
      const r = await doors.decideAccess(act.requestId, verb === 'allow' ? 'allowed' : 'denied', { ...d.decision, action: verb === 'allow' ? 'access.allow' : 'access.deny', target: act.requestId })
      return r.ok ? { ok: true } : refusedBy(r.reason)
    } catch (e) { /* said through deps.log (the operations log) or as the refusal it returns */
      return refusedBy(e instanceof Error ? e.message : String(e))
    }
  }
}
// #endregion people-ask-run
