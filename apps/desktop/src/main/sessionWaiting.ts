// #region session-waiting — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
/**
 * What waits for a session's project when it starts (0.3.14 wave 2): `fabric_whoami`, the first call of every session,
 * names the board requests addressed to the project still queued, the answers to the requests it sent that it has not
 * read, and its open questions to the operator. In the live audit of 2026-10-26 the sweep found 44 unread answers and
 * 16 to 18 unmoved requests while a new session was told nothing of them.
 *
 * Bounded: the board is read through the session's own reader door (`board.list` with `since`, so each message says
 * whether this project read it) over the last seven days, when a request with no deadline of its own expires (migration
 * 120), at most three pages of a hundred; past that every count is "at least" (`more`). Each part is read in its own
 * try: one that fails says unread with its reason, never zero.
 */

/** How many lines each part names; the count covers all it read. */
export const WAITING_ITEMS = 5
/** How many open questions are read; past it the count is "at least". */
export const QUESTIONS_READ = 50
const PAGE = 100
const PAGES = 3
/** A request with no deadline of its own expires after seven days (migration 120, `board_request_default_ttl`). */
const BOARD_WINDOW_MS = 7 * 24 * 3600_000
const LINE_CHARS = 120

type Part<T> = ({ read: true } & T) | { read: false; reason: string }

export interface WaitingBlock {
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
}

export const WAITING_NOTE =
  'What waits for this project now: board requests addressed to it (read each with com.get, answer with com.reply), answers to its own requests not yet read (com.list {unread: true}, then com.read_ack), and its open questions to the operator (fabric_question_check). A part that could not be read says so; it is never zero.'

const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const oneLine = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > LINE_CHARS ? `${flat.slice(0, LINE_CHARS - 3)}...` : flat
}

/** The board's messages of the window, paged; `more` when the bound stopped it. A refusal or a throw is a reason. */
async function readBoard(r: WaitingReads): Promise<{ messages: PageMessage[]; more: boolean } | { reason: string }> {
  const since = new Date(r.now - BOARD_WINDOW_MS).toISOString()
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

export async function readWaiting(r: WaitingReads): Promise<WaitingBlock> {
  const [board, questions] = await Promise.all([
    readBoard(r),
    r.openQuestions().then((rows) => ({ rows }), (e: unknown) => ({ reason: said(e) }))
  ])
  let boardRequests: WaitingBlock['board_requests']
  let boardAnswers: WaitingBlock['board_answers']
  if ('reason' in board) {
    boardRequests = { read: false, reason: board.reason }
    boardAnswers = { read: false, reason: board.reason }
  } else {
    const more = board.more ? { more: true as const } : {}
    const queued = board.messages.filter((m) => m.kind === 'request' && m.request?.target === r.projectId && m.request.state === 'queued' && m.sender.project !== r.projectId)
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
  return { board_requests: boardRequests, board_answers: boardAnswers, questions: qs, note: WAITING_NOTE }
}
// #endregion session-waiting
