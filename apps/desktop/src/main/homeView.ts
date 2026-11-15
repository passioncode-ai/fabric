/**
 * The home's one reading, assembled from its stages (W3 of the quality waves, 2026-11-15: moved out of `index.ts`, which
 * kept it as a closure over a dozen of its locals). Each stage owns its file; this one only orders them and says which
 * reads run beside the chain. `index.ts` wraps it in `createSharedReading` (perf PF-2), so every reader shares one.
 */
import type { HomeView } from '../shared/homeLive.ts'
import { readHome, type HeldSession, type SessionSign } from './workRead.ts'
import { withBranches, type BranchReader } from './agentBranches.ts'
import { readHandedInToday, withStrip } from './homeStrip.ts'
import { withHeartbeats } from './agentHeartbeats.ts'
import { withGoals } from './agentGoals.ts'
import { withIdentity } from './agentIdentity.ts'
import { withWork, type BoardRun } from './agentWork.ts'
import { withDisplayNames } from './projectNames.ts'

type DisplayNames = Awaited<ReturnType<Parameters<typeof withDisplayNames>[1]>>

export interface HomeViewDeps {
  store: Parameters<typeof readHome>[0]
  heldSessions(): HeldSession[]
  sessionSign: SessionSign
  branchReader: BranchReader
  /** CO-459: the branch a session without a console here reported on its last turn. */
  reportedBranch(sessionId: string): string | null
  /** Runs the board dispatcher started, at work while Switchboard reports them running. */
  boardRuns(): readonly BoardRun[]
  /** The latest sweep of abandoned work, null before the first. */
  sweep(): { unclaimed?: number | null; unclaimedSessions?: string[] } | null
  readNames(): Promise<DisplayNames>
  onNamesUnread(e: unknown): void
  now?: () => number
}

export async function readHomeView(deps: HomeViewDeps): Promise<HomeView> {
  const store = deps.store
  const held = deps.heldSessions()
  // 0.3.14, the simple Fabric: each console's git branch for the left column and «В работе» (`agentBranches.ts`).
  const now = (deps.now ?? Date.now)()
  // W3 of the quality waves (perf PF-2): the two reads that need nothing from the chain below (today's handed-in
  // events and the projects' names) start now and run beside it; each is still said unread on its own when it fails.
  // The no-op catch only keeps an early failure from reading as unhandled: the awaits below still see it.
  const handedInRead = readHandedInToday(store as never, { now })
  handedInRead.catch(() => undefined)
  const namesRead = deps.readNames()
  namesRead.catch(() => undefined)
  // Each agent's goal (the operator's second review, R-3): the root of its task's spawned links (`agentGoals.ts`).
  // ER-18: each agent's newest heartbeat, so every screen judges its status from the same inputs (`agentHeartbeats.ts`).
  // The mockup parity (home gaps D5, D6): an agent that re-enrolled keeps its stage reports, heartbeats and running
  // task across its session ids (`agentIdentity.ts`), before its goal is walked from that task.
  const home = await readHome(store, { now, session: deps.sessionSign, sessions: held })
  const branched = await withBranches(home, held, deps.branchReader, deps.reportedBranch)
  const identified = await withIdentity(await withHeartbeats(branched, store as never), store as never, held, now)
  // Home gaps D3, D4, D7: at work apart from connected, ordered by work, not by keep-alive pings (`agentWork.ts`).
  // 2026-11-11: a run the board dispatcher started is at work while Switchboard reports it running (`boardRunsOf`).
  const view = await withWork(await withGoals(identified, store as never), store as never, held, now, deps.boardRuns())
  // The strip's own reads (`homeStrip.ts`): «Сдано сегодня» and the sweep's «Работают без задачи», each said unread alone.
  const stripped = await withStrip(view, { handedIn: () => handedInRead, sweep: deps.sweep })
  // Every project's display name (rail gap §2, `projectNames.ts`).
  return withDisplayNames(stripped, () => namesRead, deps.onNamesUnread)
}
