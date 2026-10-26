// #region session-waiting — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
/**
 * What waits for a session's project when it starts (0.3.14 wave 2): `fabric_whoami`, the first call of every session,
 * names the board requests addressed to the project still queued, the answers to the requests it sent that it has not
 * read, and its open questions to the operator. In the live audit of 2026-10-26 the sweep found 44 unread answers and
 * 16 to 18 unmoved requests while a new session was told nothing of them.
 *
 * Bounded: the board is read through the session's own reader door (`board.list` with `since`, so each message says
 * whether this project read it) over the last seven days, when a request with no deadline of its own expires (migration
 * 120), at most three pages of a hundred per window; past that every count is "at least" (`more`). The reader pages
 * oldest first, so when the week does not fit the newest day, then the newest hour, is read too (the 0.3.14 review,
 * iteration 1, DA-4, ER-10): the newest requests, the ones still live, are never the ones left out. Each part is read
 * in its own try under one deadline (ER-9): one that fails or runs past it says unread with its reason, never zero.
 */

/** How many lines each part names; the count covers all it read. */
export const WAITING_ITEMS = 5
/** How many open questions are read; past it the count is "at least". */
export const QUESTIONS_READ = 50
const PAGE = 100
const PAGES = 3
/** A request with no deadline of its own expires after seven days (migration 120, `board_request_default_ttl`). */
export const WAITING_WINDOW_DAYS = 7
const BOARD_WINDOW_MS = WAITING_WINDOW_DAYS * 24 * 3600_000
/** The windows read, widest first: when one does not fit the bound, a narrower one keeps the newest (DA-4, ER-10). */
const WINDOWS_MS = [BOARD_WINDOW_MS, 24 * 3600_000, 3600_000]
/** How long `fabric_whoami` waits for each part (ER-9): past it the part says `timeout`, and whoami answers. */
export const WAITING_DEADLINE_MS = 3000
const LINE_CHARS = 120

type Part<T> = ({ read: true } & T) | { read: false; reason: string }

export interface WaitingBlock {
  /** How far back the board was read (DA-3): an answer to an older request is not counted. */
  window_days: number
  board_requests: Part<{ queued: number; items: string[]; more?: true }>
  board_answers: Part<{ unread: number; more?: true }>
  questions: Part<{ open: number; items: string[]; more?: true }>
  note: string
}

interface PageMessage {
  id: string
  kind: string
  sender: { project: string }
  body?: { text: string }
  replyTo?: string
  at?: string
  read?: boolean
  request?: { target: string; capability: string; state: string }
}

export interface WaitingReads {
  projectId: string
  now: number
  /** One page of the board as this project reads it (`boardService.ts#createBoard`'s `list`), or its refusal. */
  listPage(args: { since: string; limit: number; cursor?: string }): Promise<Record<string, unknown>>
  /** The project's open questions, oldest first, bounded by the caller; a read that fails throws. */
  openQuestions(): Promise<Array<{ id: string; text: string }>>
  /** Each part's deadline; `WAITING_DEADLINE_MS` when absent. */
  deadlineMs?: number
}

export const WAITING_NOTE =
  'What waits for this project now, from the board\'s last 7 days (window_days): board requests addressed to it, each with its id (read each with com.get, answer with com.reply); the count of answers to its own requests not yet read (com.list {unread: true}, then com.read_ack); and its open questions to the operator, each with its id (fabric_question_check). A part that could not be read, or not within its deadline, says so; it is never zero.'

const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const oneLine = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > LINE_CHARS ? `${flat.slice(0, LINE_CHARS - 3)}...` : flat
}

/** One window of the board, paged; `more` when the bound stopped it. A refusal or a throw is a reason. */
async function readWindow(r: WaitingReads, windowMs: number): Promise<{ messages: PageMessage[]; more: boolean } | { reason: string }> {
  const since = new Date(r.now - windowMs).toISOString()
  const messages: PageMessage[] = []
  let cursor: string | undefined
  try {
    for (let page = 0; page < PAGES; page++) {
      const p = await r.listPage({ since, limit: PAGE, ...(cursor ? { cursor } : {}) })
      const refused = p.error as { message?: unknown } | undefined
      if (refused) return { reason: typeof refused.message === 'string' ? refused.message : 'the board could not be read' }
      if (!Array.isArray(p.messages)) return { reason: 'the board answered an unexpected shape' }
      messages.push(...(p.messages as PageMessage[]))
      cursor = typeof p.cursor === 'string' ? p.cursor : undefined
      if (!cursor) return { messages, more: false }
    }
  } catch (e) {
    return { reason: said(e) }
  }
  return { messages, more: true }
}

/** The board's messages of the week, newest kept (DA-4, ER-10): the week, and when it does not fit the bound, the newest
 *  day, then the newest hour; every message read is kept once, so a request read in the week's oldest pages still
 *  names its answer read in the newest day. `more` when some of the week was not read. */
async function readBoard(r: WaitingReads): Promise<{ messages: PageMessage[]; more: boolean } | { reason: string }> {
  const byId = new Map<string, PageMessage>()
  for (const w of WINDOWS_MS) {
    const page = await readWindow(r, w)
    if ('reason' in page) return byId.size ? { messages: [...byId.values()], more: true } : page
    for (const m of page.messages) byId.set(m.id, m)
    if (!page.more) return { messages: [...byId.values()], more: w !== WINDOWS_MS[0] }
  }
  return { messages: [...byId.values()], more: true }
}

/** A part's read raced against the deadline (ER-9): past it, `{reason: 'timeout'}`; the timer never holds the process. */
function within<T>(read: Promise<T>, ms: number): Promise<T | { reason: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<{ reason: string }>((resolve) => {
    timer = setTimeout(() => resolve({ reason: 'timeout' }), ms)
    ;(timer as { unref?: () => void }).unref?.()
  })
  return Promise.race([read, late]).finally(() => clearTimeout(timer))
}

export async function readWaiting(r: WaitingReads): Promise<WaitingBlock> {
  const ms = r.deadlineMs ?? WAITING_DEADLINE_MS
  const [board, questions] = await Promise.all([
    within(readBoard(r), ms),
    within(r.openQuestions().then((rows) => ({ rows }), (e: unknown) => ({ reason: said(e) })), ms)
  ])
  let boardRequests: WaitingBlock['board_requests']
  let boardAnswers: WaitingBlock['board_answers']
  if ('reason' in board) {
    boardRequests = { read: false, reason: board.reason }
    boardAnswers = { read: false, reason: board.reason }
  } else {
    const more = board.more ? { more: true as const } : {}
    // Newest first: the lines name the requests still live (DA-4).
    const queued = board.messages.filter((m) => m.kind === 'request' && m.request?.target === r.projectId && m.request.state === 'queued' && m.sender.project !== r.projectId)
      .sort((a, b) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0))
    const sent = new Set(board.messages.filter((m) => m.kind === 'request' && m.sender.project === r.projectId).map((m) => m.id))
    const unread = board.messages.filter((m) => m.replyTo && sent.has(m.replyTo) && m.sender.project !== r.projectId && m.read === false)
    boardRequests = {
      read: true, queued: queued.length, ...more,
      items: queued.slice(0, WAITING_ITEMS).map((m) => `${m.id}: from ${m.sender.project} (${m.request!.capability}): ${m.body ? oneLine(m.body.text) : '(no text)'}`)
    }
    boardAnswers = { read: true, unread: unread.length, ...more }
  }
  const qs: WaitingBlock['questions'] = 'reason' in questions
    ? { read: false, reason: questions.reason }
    : { read: true, open: questions.rows.length, items: questions.rows.slice(0, WAITING_ITEMS).map((q) => `${q.id}: ${oneLine(q.text)}`),
        ...(questions.rows.length >= QUESTIONS_READ ? { more: true as const } : {}) }
  return { window_days: WAITING_WINDOW_DAYS, board_requests: boardRequests, board_answers: boardAnswers, questions: qs, note: WAITING_NOTE }
}
// #endregion session-waiting
