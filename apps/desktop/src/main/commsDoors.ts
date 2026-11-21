// #region comms-doors — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * ADR-0195 W2c.2b, the third group: the thirteen Comms doors of the window (`FabricApi['comms']`) as plain functions
 * over the operator's read onto the project board (`commsOperatorRead.ts#createCommsOperatorRead`) and the store of
 * the process that serves them. The window's IPC doors call them (`index.ts`, region `comms-screen`), and
 * `commsDoorTable` names the same functions for the board's operator door (`operatorDoor.ts#startOperatorDoor`), so
 * the window and a board process answer alike. Nothing here imports Electron; every answer is the one `index.ts`
 * gave before the move. Every door but `openArtifact` is a read: unavailable is never empty, and the board's refusals
 * travel unchanged, as the read module answers them.
 */
import type { FabricApi } from '../shared/types.ts'
import type { createCommsOperatorRead } from './commsOperatorRead.ts'
import { createWaitingReader, type WaitingListDeps } from './commsWaitingList.ts'
import type { OperatorDoorHandler } from './operatorDoor.ts'
import { readProjectRequests, type ProjectRequestsDeps } from './projectRequests.ts'

type Comms = FabricApi['comms']
type Answer<K extends keyof Comms> = Awaited<ReturnType<Comms[K]>>
type CommsRead = ReturnType<typeof createCommsOperatorRead>

/** How many threads a page holds when the caller names no number (the window's door before the move). */
const THREAD_PAGE = 50

export interface CommsDoorsDeps {
  /** The operator's read onto the board, built by the process that serves the doors: its database client, and its own
   *  way to open an artifact's link (the read module refuses every scheme but https before that is reached). */
  read: Pick<CommsRead, 'threads' | 'list' | 'threadPage' | 'heads' | 'responders' | 'facts' | 'timeline' | 'related' | 'search' | 'pending' | 'waiting' | 'openArtifact'>
  /** The estate every read is asked for. */
  estateId: string
  /** The estate's store of the process that serves the doors: the waiting list and one project's requests read it. */
  store(): WaitingListDeps['store'] & ProjectRequestsDeps
  now?: () => number
}

export interface CommsDoors {
  threads(): Promise<Answer<'threads'>>
  list(threadId: unknown, afterSeq: unknown, limit?: unknown): Promise<Answer<'list'>>
  threadPage(filter: unknown, before: unknown, limit?: unknown): Promise<Answer<'threadPage'>>
  heads(): Promise<Answer<'heads'>>
  responders(): Promise<Answer<'responders'>>
  facts(messages: unknown): Promise<Answer<'facts'>>
  timeline(requestId: unknown): Promise<Answer<'timeline'>>
  related(threadId: unknown): Promise<Answer<'related'>>
  search(query: unknown, before: unknown): Promise<Answer<'search'>>
  pending(): Promise<Answer<'pending'>>
  waiting(): Promise<Answer<'waiting'>>
  projectRequests(projectId: unknown): Promise<Answer<'projectRequests'>>
  openArtifact(url: unknown): Promise<Answer<'openArtifact'>>
}

/** The names the operator door serves this group under, in the order of `FabricApi['comms']`. */
export const COMMS_DOOR_NAMES = ['comms.threads', 'comms.list', 'comms.threadPage', 'comms.heads', 'comms.responders', 'comms.facts', 'comms.timeline', 'comms.related', 'comms.search', 'comms.pending', 'comms.waiting', 'comms.projectRequests', 'comms.openArtifact'] as const

export function createCommsDoors(d: CommsDoorsDeps): CommsDoors {
  const now = d.now ?? Date.now
  const estate = d.estateId
  // The mockup parity (home gap D11): the waiting requests themselves beside the count (`commsWaitingList.ts`).
  // CO-477: one reading at a time, and the list read again only when the count moved or after 15 s. The reader is
  // kept by these doors, so the window and every caller of the operator door share the one reading in flight.
  const waitingReader = createWaitingReader(() => d.read.waiting(estate), {
    store: d.store(), now,
    responders: () => d.read.responders(estate),
    threads: () => d.read.threadPage(estate, { kind: 'request', openOnly: true }, null, THREAD_PAGE)
  })
  return {
    threads() {
      return d.read.threads(estate)
    },
    list(threadId, afterSeq, limit) {
      // The window's door took these typed from the renderer; a caller of the operator door is held to the same types.
      // No thread (null, or none named) is the estate's page; a thread that is neither that nor a string is the empty
      // one, which the read refuses as invalid, so a malformed call never widens to every thread. The read checks
      // `afterSeq` itself, and a limit that is not a number is the read's own default.
      const thread = threadId === null || threadId === undefined ? null : typeof threadId === 'string' ? threadId : ''
      return d.read.list(estate, thread, afterSeq as number, typeof limit === 'number' ? limit : undefined)
    },
    // Wave 4's reads (migration 89). The caller's arguments are unknown here: each read checks them before the door.
    threadPage(filter, before, limit) {
      return d.read.threadPage(estate, filter, before, typeof limit === 'number' ? limit : THREAD_PAGE)
    },
    heads() {
      return d.read.heads(estate)
    },
    responders() {
      return d.read.responders(estate)
    },
    facts(messages) {
      return d.read.facts(estate, messages)
    },
    timeline(requestId) {
      return d.read.timeline(estate, requestId)
    },
    related(threadId) {
      return d.read.related(estate, threadId)
    },
    search(query, before) {
      return d.read.search(estate, query, before)
    },
    pending() {
      return d.read.pending(estate)
    },
    waiting() {
      return waitingReader.read()
    },
    // SCN-181 (CO-543): one project's requests both ways (`projectRequests.ts`); a failed read rejects.
    async projectRequests(projectId) {
      return readProjectRequests(d.store(), projectId, now())
    },
    openArtifact(url) {
      return d.read.openArtifact(url)
    }
  }
}

/**
 * The group as the operator door serves it: a call's `args` are the positional arguments the window's door takes
 * (`callOperatorDoor(root, 'comms.list', [threadId, 0, 50])`). Anything but an array is refused before a door runs,
 * since a door reading `undefined` for every argument would answer as if the person had asked for nothing.
 */
export function commsDoorTable(doors: CommsDoors): ReadonlyMap<(typeof COMMS_DOOR_NAMES)[number], OperatorDoorHandler> {
  const positional = (args: unknown): unknown[] => {
    if (!Array.isArray(args)) throw new Error('a comms door takes its arguments as a list')
    return args
  }
  return new Map<(typeof COMMS_DOOR_NAMES)[number], OperatorDoorHandler>([
    ['comms.threads', (a) => (positional(a), doors.threads())],
    ['comms.list', (a) => { const [threadId, afterSeq, limit] = positional(a); return doors.list(threadId, afterSeq, limit) }],
    ['comms.threadPage', (a) => { const [filter, before, limit] = positional(a); return doors.threadPage(filter, before, limit) }],
    ['comms.heads', (a) => (positional(a), doors.heads())],
    ['comms.responders', (a) => (positional(a), doors.responders())],
    ['comms.facts', (a) => doors.facts(positional(a)[0])],
    ['comms.timeline', (a) => doors.timeline(positional(a)[0])],
    ['comms.related', (a) => doors.related(positional(a)[0])],
    ['comms.search', (a) => { const [query, before] = positional(a); return doors.search(query, before) }],
    ['comms.pending', (a) => (positional(a), doors.pending())],
    ['comms.waiting', (a) => (positional(a), doors.waiting())],
    ['comms.projectRequests', (a) => doors.projectRequests(positional(a)[0])],
    ['comms.openArtifact', (a) => doors.openArtifact(positional(a)[0])]
  ])
}
// #endregion comms-doors
