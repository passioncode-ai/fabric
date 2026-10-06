import type { BoardCommandResult, DeferredEntry, ResolvedEntry } from './boardResolved.ts'
import type { ReleaseCommandResult, ReleaseEntry } from './releases.ts'
import type { TerminalStopResult, TerminalTermination } from './stop.ts'
import type { OpsLevel, OpsRecord } from './opsLog.ts'
import type { ProjectSettingsWrite, SaveSettingsInput } from './projectSettings.ts'
// The typed IPC contract (iteration-1-modules.md §10). The renderer never
// touches the database; this file is its entire surface.

import type { TaskState } from './ladder.ts'
import type { GoalRow } from './plan.ts'
import type { AttentionItem } from './attention.ts'
import type { HubActResult, HubOverview } from './access.ts'
import type { AboutNamespace, CorrectionOutcome, InsightCategory } from './memoryContract.ts'
import type { RetroPage, RetroQuery } from './retroView.ts'
import type { BuildLine, BuildManifest, CompatibilityVerdict } from './buildManifest.ts'
import type { BoardCut } from './board.ts'
import type { ReadEnvelope } from './readEnvelope.ts'
import type { MemoryOverview } from './memoryOverview.ts'
import type { Digest, DigestBoundary } from './digest.ts'
import type { SearchGroup } from './search.ts'
import type { Lineage } from './decisions.ts'
import type { SurfaceTool } from './surfaceTools.ts'
import type { Tenure } from './tenure.ts'

export type { Tenure }

/** What the estate's own record says about itself. Every number is a count of
 *  rows, and a store that could not be read reports null rather than zero. */
export interface EstateSummary {
  tenure: Tenure
  projects: number | null
  sessions: number | null
  tasksClosed: number | null
  facts: number | null
  decisions: number | null
  grantsIssued: number | null
  events: number | null
}

export type { SurfaceTool }

/** What a session gets, and what it may do with it. */
/**
 * The harness snapshot now lives in `harness.ts`, per source and per scope.
 *
 * It was four plain fields here, which left the handler nowhere to say that a
 * read had refused — and `live.count ?? 0` duly said "no live authority here"
 * for a grants table that would not answer (UX28-05).
 */
import type { Harness } from './harness.ts'
import type { DraftFile, DraftReadStatus } from './onboardingDraft.ts'
import type { PersistedTabs } from './tabs.ts'
export type { Harness, HarnessAgent, HarnessGrants, HarnessServer, EstateWideField } from './harness.ts'

export type { Lineage }

export type { SearchGroup }

export type { Digest, DigestBoundary }

export type { MemoryOverview }

/** One question memory was asked and could not answer. Read as a backlog of
 *  what nobody has written down, never as a list of errors. */
export interface MemoryMiss {
  store: string
  query: string
  askedAt: string
  bySession: string | null
}

export type { AttentionItem }

export type { GoalRow }

export interface ProjectRow {
  id: string
  estate_id: string
  name: string
  purpose: string | null
  /** The primary repository — derived from project_repos, mirrored here. */
  repo_path: string | null
  status: 'active' | 'archived'
  config_revision: number
  created_at: string
  memory_backend: MemoryBackend
  default_agent: string
  /** Server names this project's sessions may reach through the machine gateway
   *  (M127). Names only — Fabric stores no credential, here or anywhere. */
  mcp_servers: string[]
}

export type MemoryBackend = 'local' | 'cloud'

export interface RepoRow {
  id: string
  project_id: string
  path: string
  label: string | null
  is_primary: boolean
  attached_at: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  size: number | null
}

export interface FilePayload {
  path: string
  name: string
  content: string
  /** False when the file is not text (a NUL byte or invalid UTF-8): `content` is empty and the file
   *  is never written from the editor (audit 2026-10-05 A4-001). */
  text: boolean
  /** sha256 of the bytes as read — the caller returns it on write. */
  hash: string
  language: string
}

export type WriteResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'changed-on-disk'; current: string; currentHash: string }
  /** The file on disk is not text (any more): the editor never writes over it. */
  | { ok: false; reason: 'not-text' }
  /** M139 — policy refused the overwrite; `detail` is its own words, not a stack. */
  | { ok: false; reason: 'refused'; detail: string }

/** What a move answers with. A refusal carries the reason in the ladder's own
 *  words, so the interface never has to invent an explanation. */
export type MoveResult = { ok: true } | { ok: false; reason: string }

export type BriefSection = 'what' | 'why' | 'expected'

/** One working note on a task. Append-only by grants, not by convention: no
 *  role holds UPDATE on the table. */
export interface TaskNote {
  id: string
  task_id: string
  author_kind: 'person' | 'agent' | 'system'
  author_id: string
  body_md: string
  /** Set once the note has been promoted. The note stays where it is — this is
   *  a pointer to where the knowledge went, never a copy of it. */
  promoted_fact_id: string | null
  created_at: string
}

export interface TaskLinkRow {
  task_id: string
  rel: 'blocks' | 'follows' | 'spawned'
  target_kind: 'task' | 'goal'
  target_id: string
  /** Resolved for display, so the page never renders a bare uuid at a person. */
  target_title: string | null
}

/**
 * A task, whole. The page built on this is deliberately NOT a second set of
 * documentation (§1 of operating-surfaces.md): notes are bounded working
 * context that LEAVE for memory when they matter, and anything durable is
 * linked rather than restated.
 */
export interface TaskDetail {
  task: TaskRow
  notes: TaskNote[]
  links: TaskLinkRow[]
  /** Who holds the task right now, if anyone. */
  lease: { owner_session: string; expires_at: string; write_scopes: string[] } | null
  /** The journal rows that mention this task — its receipts, in order. */
  events: FeedEvent[]
  /**
   * Other tasks out of the same DOCUMENT (M124) — the reverse of `origin_ref`,
   * which nothing could walk before. `total` is the true count and `shown` is
   * bounded: a shortened list that does not say so reads as the whole of it.
   */
  siblings: { total: number; shown: { id: string; title: string; status: TaskState }[] }
}

export interface TaskRow {
  id: string
  project_id: string
  instruction: string
  option_id: string
  session_id: string | null
  preset: string | null
  /** The board ladder — `ladder.ts` owns the states AND who may move between
   *  them, so the union is not re-typed here where it could drift. */
  status: TaskState
  exit_code: number | null
  started_at: string
  finished_at: string | null
  /** Why a task closed without an exit code (M43). Null when it really finished. */
  abandoned_reason: string | null
  /** Why a cancelled task was cancelled — required by the close action. */
  closed_reason: string | null
  /** The board fields (operating-surfaces.md §4). Null on tasks that predate
   *  the ladder: `instruction` is what those carry instead of a title. */
  title: string | null
  task_type: string | null
  section: string | null
  goal_id: string | null
  position: number | null
  /** What this task came OUT of — an observation, a person, another task. A
   *  card with no evidence is refused at the tool that creates it. */
  origin_kind: string | null
  origin_ref: string | null
  assigned_by: string | null
  assigned_to: string | null
  /** Who last moved this card, and when (M124). `moved_by_kind` is the
   *  load-bearing half: it decides whether the line beside a card in `review`
   *  is a claim or a decision. Null means never moved — not moved by nobody. */
  moved_by: string | null
  moved_by_kind: 'person' | 'agent' | null
  moved_at: string | null
  /** The brief, with TWO writers and both kept: an agent drafts it, the
   *  operator can replace any section, and `brief_draft` holds what the agent
   *  proposed so an override never erases it. */
  brief_what: string | null
  brief_why: string | null
  brief_expected: string | null
  brief_author: string | null
  brief_draft: { section: string; body_md: string } | null
}

/** A named starting instruction. Presets are content, not code: adding one is a
 *  row in the string registry, which is why the kickoff block could become one.
 *
 *  The type lives in `presets.ts` with the rules that resolve it — a preset may
 *  READ the project now (M121), and a shape defined apart from the code that
 *  interprets it is a shape free to grow a field nothing honours. */
export type { TaskPreset } from './presets.ts'

export interface ProjectStats {
  agentsRunning: number
  repos: number
  memoryFacts: number
  memorySuperseded: number
  transcripts: number
  transcriptChars: number
  /** How often memory was asked, and how often it had nothing (M46). */
  retrievals: number
  retrievalMisses: number
  events: number
  lastActivityAt: string | null
  /**
   * M57, reopened by M113 — what the CODE is doing, as opposed to what our own
   * storage holds. Null when the project has no repository attached: absent is
   * not zero, and a project with nothing to measure must not read as a project
   * where nothing happened.
   */
  code: CodeStats | null
}

/** M57 — see `main/codeStats.ts` for what is measurable here and what is not. */
export interface CodeStats {
  trackedFiles: number | null
  trackedLines: number | null
  commits: number | null
  linesAdded: number | null
  linesRemoved: number | null
  /** "12 commits" is not a fact without this. */
  windowDays: number
  readAt: string
  error: string | null
}

/**
 * One captured session (M45). The list carries L0 and L1; `body` is the whole
 * thing and arrives only when it is asked for, so browsing a project does not
 * pull megabytes nobody reads.
 */
export interface SessionTranscript {
  sessionId: string
  optionId: string | null
  annotation: string
  excerpt: string
  body?: string
  bytes: number
  lines: number
  truncated: boolean
  startedAt: string | null
  endedAt: string | null
  exitCode: number | null
  capturedAt: string | null
  endingProvenance: 'legacy' | 'observed' | 'unknown'
}

/** M56 — what the code is doing, per attached repository. */
export interface RepoState {
  path: string
  branch: string | null
  /** Null when the branch has no upstream — a fact, not a failure. */
  ahead: number | null
  behind: number | null
  changed: number
  untracked: number
  lastCommit: { sha: string; subject: string; at: string } | null
  readAt: string
  error: string | null
}

export interface QuotaWindow {
  utilization: number
  resetsAt: string | null
}

/**
 * M83 — the account's Claude quota. Account-level, never per project: the
 * endpoint knows nothing about projects or sessions, and returns no dollars
 * (CO-096, measured). It answers "can I start a big job now, or wait".
 */
export interface Quota {
  fiveHour: QuotaWindow | null
  sevenDay: QuotaWindow | null
  byModel: Record<string, QuotaWindow>
  readAt: string
  ageSeconds: number
  problem: 'no-credential' | 'credential-refused' | 'unreachable' | 'rejected' | 'empty' | 'throttled' | null
  /**
   * Which account this reading is ABOUT (FA-03).
   *
   * A fingerprint, never the credential. Headroom is a fact about one account,
   * and a reading taken for another one is not a weaker answer — it is an
   * answer to a different question. Null while the producer cannot say.
   */
  account: string | null
}

export interface MemoryBackendOption {
  id: MemoryBackend
  available: boolean
  /** Why it is unavailable, when it is — shown, never hidden. */
  reason: string | null
}

/**
 * M73. `while-working` is the default: `always` turns a laptop into a server
 * and `never` means a long session will one day die in its sleep.
 */
export type KeepAwake = 'always' | 'while-working' | 'never'

/**
 * ONE DEFINITION, and it was two until S14 measured it. This interface carried
 * three fields while `main/settings.ts` declared the same name with five — so
 * the renderer's type asserted that settings have no `workspace` and no `tabs`
 * while the main process was sending both. Neither declaration was wrong on its
 * own; together they made the boundary type a statement nobody could rely on.
 */
export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  locale: 'en' | 'ru'
  keepAwake: KeepAwake
  /**
   * Where the declared layer is mirrored, and whether the operator was asked
   * (M118, ADR-0002).
   *
   * THREE STATES, NOT TWO. `unanswered` is not `declined`: one means nobody has
   * put the question, the other means somebody answered it. Collapsing them
   * makes the product either nag a person who already said no, or quietly never
   * ask — and quietly never asking is how an estate ends up with no history and
   * nobody having chosen that.
   *
   * It is local to the machine rather than journalled because it is a PATH: an
   * estate carried to another one arrives without it, correctly.
   */
  workspace: { path: string | null; git: 'yes' | 'declined' | 'unanswered' }
  /**
   * The working set — which project tabs are open and which is in front (M111).
   * Local for the same reason. ONE declaration: this was a hand-written copy of
   * `tabs.ts`'s shape, and it drifted the moment drafts became restorable
   * (AX-05, R-005) — the comment here still said "drafts are never in it" while
   * that file had started putting them there.
   */
  tabs: PersistedTabs
  /**
   * How far this operator has read the estate's history (AX-07).
   *
   * Local for the same reason as the two above: it is what THIS person on THIS
   * machine has looked at, not a fact about the estate. Carried elsewhere it
   * would claim someone else's attention.
   *
   * `inbox.ts` has held the vocabulary for this since it was written — two
   * lanes, a cursor with a compare-and-swap move, an emptiness that separates
   * "nothing happened" from "nothing is wired" — and NOTHING in the product
   * used any of it. This is the first consumer.
   */
  readThroughSeq: number
  /**
   * Whether this operator finished the first run (ADR-0100, SCN-126). Local for
   * the same reason as the fields above: it is what THIS person on THIS machine
   * has been through. `null` is "not finished", which shows the first run only
   * when the estate also has no project — an installation with projects is never
   * walked back through it.
   */
  firstRun: { completedAt: string | null }
}

/**
 * The one set of defaults. The renderer used to carry its own three-field copy
 * as a read-failure fallback, which is how the drift above stayed invisible: a
 * second literal of a type is a second definition of it.
 */
export const APP_SETTINGS_DEFAULTS: AppSettings = {
  theme: 'dark',
  locale: 'en',
  keepAwake: 'while-working',
  workspace: { path: null, git: 'unanswered' },
  tabs: { tabs: [], active: null },
  // Nothing read, which is the only honest default: a fresh install has not
  // seen the history, and starting at the head would hide it.
  readThroughSeq: 0,
  firstRun: { completedAt: null }
}

export interface FeedEvent {
  estate_id: string
  seq: number
  type: string
  actor: { kind: string; id: string }
  project_id: string | null
  occurred_at: string
  payload: Record<string, unknown>
}

export interface MemoryFact {
  id: string
  project_id: string
  claim: string
  source_ref: string | null
  kind: string
  /**
   * Who recorded it, taken from the journal envelope rather than from anything
   * the caller said about itself (M44). A note the operator wrote and a fact an
   * agent reported about its own work are different kinds of evidence, and the
   * projection used to make them look identical.
   */
  actor_kind: 'person' | 'agent' | 'system' | null
  actor_id: string | null
  recorded_at: string
  /**
   * Bi-temporal (M48, ADR-0032 §4). `recorded_at` is when we learned it;
   * `valid_from`/`valid_to` is when it was true. A contradiction CLOSES the
   * earlier window and names its successor — nothing is deleted, so every
   * correction is reversible and "what did this project believe in June" stays
   * answerable.
   */
  valid_from: string
  valid_to: string | null
  superseded_by: string | null
  /** WHOSE lesson this is, beside what SORT of statement it is (M182). Every
   *  fact recorded before that migration replays to `project`, which is what
   *  it is: the old writer had one subject. */
  category: InsightCategory
  about_namespace: AboutNamespace | null
  about_key: string | null
  /** The INCIDENT this fact is about, when it is about one. Several facts can
   *  cite one occurrence, which is what stops three reports of one incident
   *  counting as three. */
  occurrence_id: string | null
  /** What was ASKED, kept apart from what happened — the two used to be the
   *  same field, and the request was returned as the outcome. */
  supersedes_requested: string | null
  correction_outcome: CorrectionOutcome
  correction_reason: string | null
}

/** What can hold a terminal today. In slice 3 this list becomes the admitted
 *  providers of the capability registry — the shape is already a list, so the
 *  selector does not change when that arrives. */
export interface LaunchOption {
  id: string
  label: string
  /** What actually runs; `null` means the login shell. */
  program: string | null
  description: string
  available: boolean
  /** Whether this option is handed a credential for the agent surface. A plain
   *  shell is not: there is nothing in it to speak the protocol. */
  connectsToSurface: boolean
  /** What this agent may be launched AS. Chosen per launch, never a setting,
   *  and recorded in `terminal.opened@1` so "what was this session allowed to
   *  do" stays answerable months later. */
  permissionModes: {
    id: string
    labelKey: string
    blockedKey: string | null
    warnKey: string | null
  }[]
  defaultMode: string | null
}

export type SessionState = 'running' | 'idle' | 'ended'

/** What an agent has said about itself. Kept apart from `TerminalSession`,
 *  which is what Fabric observed — the two are never merged into one status. */
export interface AgentClaim {
  sessionId: string
  stage: string
  step: number | null
  ofSteps: number | null
  note: string | null
  reportedAt: string
}

export interface TerminalSession {
  /** Complete execution termination is separate from root process liveness. */
  termination?: TerminalTermination
  sessionId: string
  projectId: string
  cwd: string
  program: string
  /** The launch option this session was started from. */
  optionId: string
  /** What it was allowed to do, chosen at launch. Null for a plain shell,
   *  which has nothing to ask about. */
  permissionMode: string | null
  /** The tail of recent output, for a tile that shows a few thousand characters.
   *  NOT the reattach buffer: that is fetched once per mount through
   *  `terminal.scrollback`, because carrying it in every listing sent up to
   *  400 000 characters per session across the boundary on every poll (FA-08). */
  excerpt: string
  /** Characters this session has emitted since it opened, counted before the
   *  cap drops anything. A view compares it against what a chunk carries to
   *  tell what its replay already holds. */
  written: number
  running: boolean
  state: SessionState
  startedAt: string
  lastActivityAt: string
  /** Last non-empty line of output — the short status on the agent tile. */
  tail: string
  exitCode: number | null
}

export interface CreateProjectInput {
  /**
   * Decided by the CALLER, before the first attempt (UX-06).
   *
   * The handler used to mint this itself, so a double-click or a retry after a
   * slow response produced a SECOND project — the operator asked once and got
   * two, with the repositories attached to whichever one they did not open. An
   * id chosen up front makes a retry the same create rather than a sibling, and
   * that is a property of the request rather than of how fast the operator's
   * finger is.
   */
  id: string
  name: string
  purpose?: string
  /** Repositories chosen during onboarding; the first becomes primary. */
  repoPaths?: string[]
  memoryBackend?: MemoryBackend
  defaultAgent?: string
}

/**
 * A project's own details.
 *
 * `repoPath` USED TO BE HERE and had no caller: measured across `main/` and
 * `renderer/` at UX28-11, every match was an unrelated local. It was a door
 * onto exactly what this card excludes — a repository path set as a string,
 * bypassing the opened-root boundary — held open by nothing. A repository is
 * attached through `repos.choose()` and `repos.attach`; the projector arm for
 * `project.updated@1` still reads `repo_path` from history, because events of
 * that shape exist and a projector may not stop understanding its own past.
 */
export interface UpdateProjectInput {
  id: string
  name?: string
  purpose?: string | null
}

/** An agent somebody created (M125): a named configuration of a RUNNER, not a
 *  runner. `agents.ts` still holds the runners and does not grow. */
export interface CreatedAgent {
  id: string
  project_id: string
  /** The name the operator picks it by — `role` in the binding table. */
  name: string
  /** Which program it runs in — a runner id from `agents.ts`. */
  runner_id: string
  instructions: string
  /** What it ASKS to reach. The project's list is a ceiling, not a default. */
  mcp_servers: string[]
  permission_mode: string | null
  created_by: string | null
  created_at: string
}

/** A routine: work that starts without anybody asking (M13). */
export interface RoutineRow {
  id: string
  project_id: string
  instruction: string
  option_id: string
  every_minutes: number
  /** `fixed` runs the instruction as written; `backlog` composes it at fire time
   *  from the project's backlog, and does not run at all when it is empty. */
  kind: 'fixed' | 'backlog'
  enabled: boolean
  last_run_at: string | null
  last_task_id: string | null
}

/** One routine's history, folded (M65). */
export interface AutomationStateRow {
  routineId: string
  lastRanAt: string | null
  consecutivePauses: number
  stuckBecause: string | null
}

/** A local save, and whether it happened. `reason` is present only when it did
 *  not, and it is already safe to show. */
export interface SettingsWrite {
  settings: AppSettings
  saved: boolean
  reason?: string
}

/**
 * The pins as they now stand ON DISK, and what happened.
 *
 * ONE declaration (R-005). This was declared here AND in `main/favourites.ts`,
 * with the main copy carrying the comments and the shared copy carrying three
 * bare fields — so extending the main one left the renderer typed against a
 * shape the product no longer returns, and TSC caught it only at the call site.
 * Neither was wrong alone; together they were two contracts for one boundary.
 */
export interface PinResult {
  pins: string[]
  /** Whether the change reached the disk. `toggleFavourite` used to return the
   *  value it HOPED had landed, so a full disk or a permission change lost the
   *  operator's pins with the screen still showing them pinned (S14). */
  saved: boolean
  reason?: string
  /**
   * The pin was refused because the set is full (SCN-043 step 2, UX28-10).
   *
   * NEITHER a failure nor a success: nothing was written and nothing was
   * dropped, and the operator has to say which to release. Folding it into
   * `saved: false` would report a full disk and a full favourites list in the
   * same sentence, and only one of those is something they can act on.
   */
  atLimit?: { limit: number }
}

/** Fabric's look as stored on this machine (SCR-36). */
export interface PersonaRead {
  persona: import('./persona.ts').Persona
  /** False until the operator saved a look: the default is not a choice. */
  chosen: boolean
  /** Present when the stored look could not be read; the default is then shown, labelled. */
  problem?: string
}
/** What saving a look did. */
export interface PersonaWrite {
  persona: import('./persona.ts').Persona
  saved: boolean
  reason?: string
}

/** What an arrow on "My projects" did (SCR-30/SCR-01): both orders as they now stand
 *  on disk, and whether the step landed. */
export interface ArrangeResult {
  pins: string[]
  order: string[]
  saved: boolean
  reason?: string
}

/** One page of the operations log, and where it lives. */
export interface DiagnosticsView {
  records: OpsRecord[]
  /** So a person can open the raw file, or send it. */
  file: string | null
  /** Whether the local stack answered on this Mac's network addresses (audit A7-001); null until checked. */
  stackExposure?: { checkedAt: string; ports: number[]; exposed: Array<{ iface: string; port: number }> } | null
}

/** A renderer failure, as the error boundary or the root's `onUncaughtError`
 *  saw it (audit 2026-10-05 A7-009). */
export interface RendererErrorInfo {
  message: string
  stack?: string | null
  /** The React component stack, when the error came from a render. */
  component?: string | null
}

/** What an answer did. Refusals use fixed validation or uncertainty reasons;
 * raw database error text is not exposed. */
export type AnswerReceipt =
  | { committed: false; reason: string }
  | {
      committed: true
      /** A retry of the same command returns the first commit, not a second. */
      repeated: boolean
      decisionId: string
      /** Repeat receipts may omit the sequence; absence is not a made-up value. */
      commitSeq: string | null
      /** Tasks with no open blocker left. ELIGIBLE — nobody was woken. */
      unblocked: string[]
      stillBlocked: { task_id: string; open_blockers: number }[]
          /** M152.continue — where the answer went, per unblocked task. A
           *  delivery that could not be made is not a failed answer: the
           *  decision is recorded either way, and `needs_restart` says the
           *  session that asked has gone rather than that anything broke. */
          continuations: {
            taskId: string
            /** Narrowed, not `string`: a widened wire type compares nothing,
             *  which is exactly the defect M109 swept out of the IPC surface. */
            state: import('./continuation.ts').ContinuationState
            says: string
            deliveryId?: string
            /** The delivery already existed and nothing was sent again
             *  (AX-03). Declared HERE as well as in the main process, because a
             *  field the wire carries and the declaration omits arrives
             *  untyped and is read by accident — the defect M109 swept out of
             *  this surface, in a field added after the sweep. */
            alreadyDelivered?: boolean
            deliveryState?: string
          }[]
    }

/** What `proposals.decide` answers with — including when it refuses (M168). */
export interface ProposalDecideResult {
  ok: boolean
  /** Present when a proposal was accepted and became one. */
  taskId?: string | null
  seq?: number
  /** Present when it was refused, and it is the whole point of the type. */
  rejection?: import('./proposals.ts').Rejection
}

/** What starting an EXISTING task answers with, refusal included (S04). */
export type TaskAdmission =
  | {
      admitted: true
      taskId: string
      sessionId: string
      /** Admission is distinct from delivery and receiver acknowledgement. */
      deliveryId: string
      deliveryState?: import('./continuation.ts').ContinuationState
      says?: string
    }
  | {
      admitted: false
      admissionRecorded?: boolean
      taskRunId?: string
      sessionId?: string
      /** Machine-stable, so a surface acts on the class rather than the prose. */
      reasonCode: string
      says: string
      remedy?: string
      /** Present when the refusal was the blocking set. */
      openBlockers?: number
      /** `unavailable` is retryable; a real refusal is not. */
      retryable: boolean
    }

/** What a dry pack preview answers with (M191). */
export interface PackPreview {
  markdown: string
  sha256: string
  /** Which selection rules produced it, so a preview and a recorded pack are
   *  comparable rather than assumed equivalent. */
  compilerRevision: number
  /** The budget it was compiled against, so `chars` has a scale. */
  budget: number
  chars: number
  includedFacts: number
  includedTranscripts: number
  omittedFacts: number
  omittedTranscripts: number
  /** A source that failed is not a source that was empty (S14). */
  read: import('./readEnvelope.ts').ReadEnvelope<null>
}

/** A task list with its own honesty about what it left out (M190). */
export interface TaskList {
  tasks: TaskRow[]
  /** The finished half only: open tasks are never capped. */
  closed: { truncated: boolean | 'unknown'; says: string }
}

/** Decision lineages with the coverage of the read behind them (M173). */
export interface DecisionList {
  lineages: import('./decisions.ts').Lineage[]
  coverage: { truncated: boolean | 'unknown'; says: string }
  /**
   * Decisions whose CURRENT version this read did not return (AX-06).
   *
   * They form no lineage, so they are absent from the list entirely rather than
   * shortened — and a panel listing nine complete histories while three are
   * invisible reads as "these are the decisions". Declared here as well as in
   * the main process, because a field the wire carries and the declaration
   * omits arrives untyped and is read by accident (M109).
   */
  orphans: { ids: string[]; says: string }
}

/** The CEO chat methods the binding accepts; the binding's table is tested against this list. */
export const CEO_CHAT_METHOD_NAMES = Object.freeze(['readDraft', 'inventory', 'saveDraft', 'discardDraft', 'forgetSettled', 'freezeSend',
  'send', 'reconcile', 'retry', 'open', 'read'] as const)
export type CeoChatMethod = (typeof CEO_CHAT_METHOD_NAMES)[number]
export interface CeoChatStatus { active: boolean; reason: 'private_recovery_unavailable' | null }
export type CeoChatReply =
  | { ok: true; state: 'ready' | 'saved_locally' | 'accepted_pending'; value: unknown; conversation_id?: string; operation_id?: string }
  | { ok: false; state: 'refused' | 'commit_unknown'; reason_code: string; conversation_id?: string; operation_id?: string }

export interface HistoryExport { name: string }
export interface HistoryArchiveSummary { token: string; taken_at: string; events: number; companion: { conversations: number; messages: number; mine: boolean } | null }
export interface AnalyticsStatus { availability: 'on' | 'off' | 'unavailable-no-key' | 'unavailable-file' }
export interface HistoryRestored { operation_id: string; target_estate_id: string; history_restored: true; access_verified: true; private_history: boolean; opened: false }
export type HistoryReply<T> = ({ ok: true } & T) | { ok: false; state: 'refused' | 'result_unknown'; reason_code: string; operation_id?: string }

export interface FabricApi {
  projects: {
    create(input: CreateProjectInput): Promise<ProjectRow>
    update(input: UpdateProjectInput): Promise<ProjectRow>
    updateSettings(input: {
      id: string
      memoryBackend?: MemoryBackend
      defaultAgent?: string
      /** Absent leaves the list alone; an EMPTY array is a decision and is
       *  written — this project reaches nothing but Fabric. */
      mcpServers?: string[]
    }): Promise<ProjectRow>
    /**
     * Every field the settings panel owns, in ONE append against the revision
     * the operator typed at (UX28-11).
     *
     * Returns an outcome rather than a row, because "committed" is not the only
     * honest answer: the base may have moved, the draft may be refused, and the
     * append may land while the read-back does not. `ProjectSettingsWrite` names all
     * five. The panel used `update` then `updateSettings` — two appends, two
     * revisions, and a half-saved project reported as untouched.
     */
    saveSettings(input: SaveSettingsInput): Promise<ProjectSettingsWrite>
    list(): Promise<ProjectRow[]>
    stats(projectId: string): Promise<ProjectStats>
    /** M56 — the state of every repository attached to this project. */
    repoStates(projectId: string): Promise<RepoState[]>
    /**
     * M107 — a repository this estate watches has moved; the argument is its
     * path and the caller decides whether it cares (`shared/repoWatch.ts`).
     *
     * It carries the PATH and not the reading: measuring git for every window
     * on every `.git` write, including the windows showing another project,
     * is the stampede this channel exists to avoid. Returns its own
     * unsubscribe, like `terminal.onData`.
     */
    onRepoChanged(cb: (repoPath: string) => void): () => void
  }
  /** M83 — account quota. Never null: a read that produced nothing is a
   *  reading whose `problem` says why (release review 2026-10-03). */
  quota: {
    read(): Promise<Quota>
  }
  transcripts: {
    list(projectId: string): Promise<SessionTranscript[]>
    get(sessionId: string): Promise<SessionTranscript | null>
    /**
     * WHAT THE SESSION WAS GIVEN, beside what it said (AX-04).
     *
     * The exact bytes, from the content-addressed packet store, or a named
     * reason they cannot be produced. Never a recompilation: memory has moved,
     * so a pack rebuilt today is a different pack wearing this session's id.
     */
    context(sessionId: string): Promise<import('./pastContext.ts').PastContext>
  }
  tasks: {
    /**
     * Start a task that ALREADY EXISTS (S04).
     *
     * Separate from `start`, which creates one. Before this there was no such
     * command: every launch appended a fresh `task.started@1`, so a task on the
     * board could never be run and the blocking set was consulted nowhere.
     * Admission is one transaction under a lock — nonterminal, unblocked, and
     * holding the only launch lease — and its refusal is RETURNED with a reason
     * code rather than thrown.
     */
    startExisting(taskId: string): Promise<TaskAdmission>
    /** Journals the task, opens a session with the instruction, links the two. */
    start(input: {
      projectId: string
      instruction: string
      optionId: string
      preset?: string
      /** True when the operator changed a preset's text before running it —
       *  the preset keeps its identity and the edit is recorded beside it. */
      presetEdited?: boolean
      /** Chosen per launch; a blocked mode is refused by the main process. */
      permissionMode?: string | null
      /** NARROWED to what is actually sent (M109). `startTask` returns
       *  `{ sessionId }` — it is also called by the routine tick and the chain
       *  advance, which need nothing more — while this said `TerminalSession`.
       *  The renderer only ever read `sessionId`, so nothing broke; reading
       *  `session.cwd` would have compiled and been `undefined`. The
       *  declaration describes what is produced, not what would be convenient. */
    }): Promise<{ task: TaskRow; session: { sessionId: string } }>
    /**
     * The project's tasks, and whether the finished half was cut short (M190).
     *
     * It returned a flat array and said nothing about the cap, so a consumer
     * counting it counted a truncated set as the whole.
     */
    list(projectId: string): Promise<TaskList>
    /** Move a task along the ladder. A refused verdict comes back as
     *  `{ ok: false, reason }` rather than throwing: a refusal is an answer the
     *  interface must SHOW, and an exception is one it tends to swallow. */
    move(taskId: string, to: TaskState): Promise<MoveResult>
    /** Accept or cancel. Cancelling REQUIRES a reason — a task that vanished
     *  without one is a lost decision. */
    close(taskId: string, outcome: 'done' | 'cancelled', reason?: string): Promise<MoveResult>
    /** Everything one task knows about itself, in one read: the brief, its
     *  working notes, what it links to, who holds it, and the journal rows that
     *  are its receipts. One call because five would be five moments in time. */
    detail(taskId: string): Promise<TaskDetail>
    note(taskId: string, body: string): Promise<void>
    /** Move a note out of the task and into project memory. The note is NOT
     *  copied — it keeps a link, and the fact is where the knowledge lives. */
    promote(noteId: string): Promise<MemoryFact>
    brief(taskId: string, section: BriefSection, body: string): Promise<void>
    /** Put a task under a goal at a position. Order is a FIELD, not a screen's
     *  opinion — two surfaces reading the same plan must agree on it. */
    prioritise(taskId: string, goalId: string, position: number): Promise<void>
    /**
     * File an idea into the backlog (M134). Its origin is the PERSON who had
     * it — a real answer at this door and an unverifiable one at an agent's,
     * which is how the board keeps its rule that a card names what it came out
     * of while still letting the operator think out loud.
     */
    fileIdea(projectId: string, text: string): Promise<TaskRow>
    /**
     * Spawn a research task FROM an idea and run it. The idea does not move: a
     * session attached to the idea's own card would be claimed and moved, and
     * the board would then say the idea is done when what is done is the
     * reading.
     */
    research(taskId: string, optionId: string): Promise<{ task: TaskRow }>
  }
  automations: {
    /**
     * What is running, what is scheduled, and what happened before — one read,
     * because three reads is three moments and the operator would be comparing
     * a running list from one second against a history from another.
     */
    read(projectId: string): Promise<{
      running: { taskId: string; title: string; startedAt: string; routineId: string | null }[]
      routines: RoutineRow[]
      states: Record<string, AutomationStateRow>
      /** Which history windows could not be READ (M186). A screen showing
       *  "never run" over a refused query states an absence it did not
       *  observe — the defect S14 exists to prevent. */
      unread: string[]
      /** Both windows are capped; a history that stops and says nothing is a
       *  claim about completeness. */
      historyCoverage: { truncated: boolean | 'unknown'; says: string }
    }>
  }
  routines: {
    list(projectId: string): Promise<RoutineRow[]>
    define(input: {
      projectId: string
      instruction: string
      optionId: string
      everyMinutes: number
      kind?: 'fixed' | 'backlog'
    }): Promise<RoutineRow>
    setEnabled(id: string, enabled: boolean): Promise<void>
  }
  agents: {
    /** Every agent created in this project, newest first. */
    list(projectId: string): Promise<CreatedAgent[]>
    /**
     * Create one. The servers it asks for are checked against what the project
     * grants: a request outside that ceiling is REFUSED here rather than trimmed,
     * because an agent that starts without a server it declared improvises around
     * the missing tool.
     */
    create(input: {
      projectId: string
      name: string
      instructions: string
      runnerId: string
      servers?: string[]
      permissionMode?: string | null
    }): Promise<CreatedAgent>
  }
  tabs: {
    /** The working set as it was left. Restored through `tabs.ts`, which drops
     *  what is gone and says which (M111). */
    read(): Promise<PersistedTabs | null>
    /** Written on every change, not on quit: saved only at the end, a crash
     *  after closing four of five tabs would bring all five back. */
    write(state: PersistedTabs): Promise<void>
    /** Fires when Cmd+W is pressed. The menu asks; the renderer owns the set. */
    onCloseActive(handler: () => void): () => void
  }
  workspace: {
    /** Where the declared layer is mirrored, and whether anyone has been asked
     *  (M118). `unanswered` is not `declined` — see `settings.ts`. */
    state(): Promise<{ path: string | null; git: 'yes' | 'declined' | 'unanswered' }>
    /**
     * Pick a folder, write the mirror, and make it a repository.
     *
     * THREE OUTCOMES, because there were three all along and the shape carried
     * two (UXA-C03). `{ path: null }` meant "the dialog was closed" and
     * `{ repository: false }` meant "the folder is there and has no version
     * history" — the first is nothing to report and the second is the operator
     * holding a workspace that is not what ADR-0048 calls one. Both arrived as
     * falsy fields on one object, and the only caller erased the object
     * entirely by typing the act as `Promise<unknown>`.
     */
    choose(): Promise<
      | { outcome: 'ready'; path: string }
      | { outcome: 'unversioned'; path: string; reason: string }
      | { outcome: 'cancelled' }
    >
    /** Answer no, once, and stop being asked. */
    decline(): Promise<void>
    /** What the files say that the estate does not. Empty is agreement. */
    check(): Promise<{ path: string; reason: string }[]>
    /**
     * Adopt an existing workspace instead of creating one. Refused when this
     * estate already holds projects: merging two estates is a thing nobody has
     * specified, and doing it by "insert what is missing" decides it by
     * accident. Ids are preserved, which is what makes it the same estate.
     */
    adopt(): Promise<
      | { outcome: 'adopted'; projects: number; agents: number }
      | { outcome: 'refused'; reason: string }
      /** The dialog was closed. NOT a refusal: the handler used to answer
       *  `{ ok: false, reason: 'nothing was chosen' }`, so telling the two apart
       *  meant matching on a message, and reporting them alike would announce
       *  every dismissed dialog. */
      | { outcome: 'cancelled' }
    >
  }
  gateway: {
    /**
     * What the machine's gateway serves, for the operator to choose from.
     *
     * THE KEY IS NOT PART OF THIS. The renderer never needs it — the bundle
     * compiler is what reaches the gateway — and a secret that crosses a bridge
     * it has no use on is a secret in a devtools console.
     */
    offer(): Promise<{ reachable: boolean; servers: string[] }>
  }
  proposals: {
    /**
     * Accept a hand-off the loop bound stopped, or let the chain end.
     *
     * Accepting creates the task — and it is created WITHOUT a spawned link to
     * the chain it came from, because a person deciding is what makes it a new
     * beginning rather than round five. Reattaching it would make the bound
     * trip again on the next hand-off, for a chain the operator has already
     * looked at.
     *
     * M168 — this returned `void`, so a refusal had nowhere to go and the only
     * way to say no was to throw, which reaches a renderer as "Error invoking
     * remote method" (M106). The contract itself forbade the answer. It now
     * carries the checker's receipt: a reason code, what to do about it, and
     * whether trying again could ever work.
     */
    decide(id: string, decision: 'accepted' | 'declined'): Promise<ProposalDecideResult>
  }
  questions: {
    /** Answer one question. One transaction resolves it, records the decision
     *  and recomputes the blocking sets — and the receipt says what became
     *  eligible, never that anything was started (M152.commit). */
    answer(input: {
      commandId: string
      questionId: string
      projectId: string
      expectedRevision: number
      answer?: string
      chosenOption?: string
      options: { id: string; label: string; consequence?: string }[]
    }): Promise<AnswerReceipt>
  },
  /** Releases with their basis (ADR-0084, `launch-releases`). */
  releases: {
    /** A project's releases, or every project's, newest first, with their state derived and what
     *  went in resolved to text where it could be read. A ReadEnvelope: an unread source is not
     *  "no releases". */
    list(q?: { projectId?: string | null; limit?: number }): Promise<ReadEnvelope<ReleaseEntry[]>>
    /** Record a release, or a rollback naming the release it replaces. One command id per attempt. */
    record(input: { commandId: string; releaseId: string; projectId: string; name: string; environment: string; summary?: string
      taskIds?: string[]; decisionIds?: string[]; rollsBack?: string | null }): Promise<ReleaseCommandResult>
    /** Record what verified a release — accepted or failed — with the receipt that backs it. */
    verify(input: { commandId: string; releaseId: string; projectId: string; outcome: 'accepted' | 'failed'; receipt: string }): Promise<ReleaseCommandResult>
  }
  board: {
    /** One ranked list of authored questions and derived obligations, cut to a
     *  scale (M151). A ReadEnvelope, so a source that failed can never render
     *  as a quiet board. */
    query(q?: { projectId?: string | null; limit?: number }): Promise<ReadEnvelope<BoardCut>>
    /** What stopped waiting because it was answered, newest first (SCR-41 «Разобрано»).
     *  A ReadEnvelope for the same reason as `query`: an unread source is not "nothing resolved". */
    resolved(q?: { projectId?: string | null; limit?: number }): Promise<ReadEnvelope<ResolvedEntry[]>>
    /** Open questions the owner set aside for next time, newest first (SCR-41 «На следующий раз»).
     *  They are NOT in `query`: set aside is not waiting on you now, though it still blocks. */
    deferred(q?: { projectId?: string | null; limit?: number }): Promise<ReadEnvelope<DeferredEntry[]>>
    /** Set an open question aside with a reason. One command id per attempt: a retry is the same act. */
    defer(input: { commandId: string; questionId: string; projectId: string; reason: string }): Promise<BoardCommandResult>
    /** Return a set-aside question to the board. */
    reopen(input: { commandId: string; questionId: string; projectId: string }): Promise<BoardCommandResult>
    /** Write a topic onto the board: an open question on the project, asked by the owner. */
    addTopic(input: { commandId: string; questionId: string; projectId: string; text: string; note?: string }): Promise<BoardCommandResult>
  },
  attention: {
    /**
     * Everything waiting on the operator, across every project. DERIVED, so
     * there is nothing to dismiss: an item leaves when the thing it names is
     * resolved. A queue you can mark as read is a queue that lies.
     *
     * A ReadEnvelope, for the reason written five lines above it and not
     * applied here until UXA-C02: a source that failed can never render as a
     * quiet queue. This read consults five tables plus a chunked lookup of
     * lease titles, and a refused `journal` select produced a queue with no
     * refusals in it that RESOLVED — so both surfaces showed a partial answer
     * as the estate's state. The receipts were measured all along and dropped
     * at this boundary.
     */
    list(): Promise<ReadEnvelope<AttentionItem[]>>
    /** Authorise one refused act. One class, one target, spent once, expires
     *  in an hour — never a setting and never a role (M140). */
    /** Issues a one-hour grant for this act and answers with it, so the act can say until when (A1-001). */
    grant(input: { projectId: string | null; floorClass: string; target: string }): Promise<{ grantId: string; expiresAt: string }>
  }
  /**
   * Agent access (ADR-0115): what registered agents on this Mac may do through Fabric, what is waiting
   * for the operator's answer, and which products are connected. Every act answers with its outcome;
   * a refusal carries its reason, never a silent no-op.
   */
  hub: {
    overview(): Promise<HubOverview>
    decide(requestId: string, decision: 'allowed' | 'denied'): Promise<HubActResult>
    revokeGrant(grantId: string): Promise<HubActResult>
    revokeAgent(bindingId: string): Promise<HubActResult>
    clearDenial(requestId: string): Promise<HubActResult>
    /** Opens the product's connect link. A connected product is connected again only with `reconnect: true`. */
    connect(product: string, opts?: { reconnect?: boolean }): Promise<HubActResult>
    disconnect(product: string): Promise<HubActResult>
  }
  /**
   * Anonymous usage counts (docs/ANALYTICS.md): whether they are sent, and the one switch every PassionCode app
   * shares. `unavailable-no-key`: a build that sends nothing (not a release build). `unavailable-file`: the
   * shared installation file could not be read, so nothing is sent and the switch cannot be written.
   */
  analytics: {
    status(): Promise<AnalyticsStatus>
    setEnabled(enabled: boolean): Promise<AnalyticsStatus>
  }
  goals: {
    list(projectId: string): Promise<GoalRow[]>
    define(projectId: string, title: string): Promise<GoalRow>
  }
  repos: {
    list(projectId: string): Promise<RepoRow[]>
    /** Opens the native folder picker; returns [] when the operator cancels. */
    choose(): Promise<string[]>
    attach(projectId: string, paths: string[]): Promise<RepoRow[]>
    detach(projectId: string, repoId: string): Promise<RepoRow[]>
  }
  files: {
    list(dir: string): Promise<{ entries: FileNode[]; truncated: number }>
    read(file: string): Promise<FilePayload>
    write(file: string, content: string, expectedHash: string, grantId?: string): Promise<WriteResult>
    /**
     * M139 — the operator's authority to overwrite what changed on disk.
     *
     * Overwriting is a `deletion`-class effect: the content being replaced may be
     * an agent's work, written seconds ago. Until this existed the only thing
     * between that and silent data loss was a banner, and nothing in the estate
     * recorded that it happened. The grant names THIS file, expires, and is spent
     * once — so `write` with a stale or absent grant is refused rather than forced.
     */
    requestOverwrite(file: string): Promise<{ grantId: string; expiresAt: string }>
    /**
     * Editor recovery (ADR-0106 amendment): the editor keeps its unsaved buffer in a recovery store as the
     * person types — `null` content discards it — so a quit, a signal or a crash never loses the work and
     * never has to wait for it. `recoveryFlush` is the fire-and-forget form used from `beforeunload`.
     */
    recoveryKeep(file: string, content: string | null, baseHash: string): Promise<{ kept: boolean; reason?: string }>
    recoveryFlush(file: string, content: string | null, baseHash: string): void
    recoveryRead(file: string): Promise<{ content: string; baseHash: string; at: string } | null>
    /**
     * Open a file in whatever the machine uses for it.
     *
     * NOT `Promise<void>` (M109). `shell.openPath` resolves to an ERROR STRING —
     * empty on success — and the handler discarded it, so a file that would not
     * open was indistinguishable from one that did. The caller could not tell
     * and therefore could not say.
     */
    openExternally(file: string): Promise<{ ok: boolean; reason?: string }>
  }
  settings: {
    read(): Promise<AppSettings>
    /** The settings AND whether they reached the disk (S14). A save that
     *  reported success while the write was refused is how a malformed
     *  `settings.json` used to take the operator's workspace path with it. */
    write(next: Partial<AppSettings>): Promise<SettingsWrite>
  }
  feed: {
    replay(fromSeq: number): Promise<FeedEvent[]>
  }
  /**
   * The onboarding form's contents, kept where the operator's own state is kept
   * (AX-05).
   *
   * It lived in renderer memory, so a half-described project died with the
   * window — and `shared/tabs.ts` refused to restore a draft tab BECAUSE of
   * that, rather than show an empty form claiming to be somebody's work.
   *
   * `save` returns the write RESULT. A draft the operator believes is safe and
   * which silently failed to reach the disk is worse than one they know is not.
   */
  drafts: {
    /**
     * THREE ANSWERS, not two (AX-05). `ready` is the file as written;
     * `recovered` means it would not parse and an earlier good copy was used —
     * usable, and worth writing back to repair it; `unreadable` means the value
     * is a default standing in for something nobody could read, and writing
     * over it would destroy the operator's draft.
     *
     * The first version of this returned `{ drafts, problem }` and the shell
     * marked the file loaded whenever the promise resolved — so an unreadable
     * file was immediately overwritten with an empty set. Its own comment said
     * the opposite. A boolean where there are three states is how that happens.
     */
    read(): Promise<{ drafts: DraftFile; status: DraftReadStatus; problem: string | null }>
    save(next: DraftFile): Promise<{ saved: boolean; reason: string | null }>
  }
  /**
   * The conversation with Fabric (SCR-64), through the main-side binding
   * (`main/ceoChatBinding.ts`). Nothing here carries identity: trusted main derives it.
   * Until private recovery is available (first-slice plan C5) `status()` is closed and every
   * call that would reach the database refuses `private_recovery_unavailable`; drafts still
   * save on this Mac.
   */
  ceo: {
    status(): Promise<CeoChatStatus>
    /** One of `CEO_CHAT_METHOD_NAMES`, with that method's fixed argument object. */
    call(method: CeoChatMethod, args: Record<string, unknown>): Promise<CeoChatReply>
    /** The conversation on screen; a read that settles for another one is `superseded`. */
    select(conversationId: string | null): Promise<{ ok: boolean }>
  }
  /**
   * Private history and restore (SCR-65, SCR-48; first-slice plan A1-6). No path and no identity
   * cross this boundary: main picks the archive folder in its own dialog and hands back a token,
   * and main derives the operator. An Estate can be opened only if this process restored it.
   */
  history: {
    list(): Promise<HistoryExport[]>
    export(): Promise<HistoryReply<{ archive_id: string; name: string; conversations: number; messages: number }>>
    /** Main's folder dialog; null when the operator cancels. */
    choose(): Promise<HistoryReply<HistoryArchiveSummary> | null>
    restore(token: string, name: string): Promise<HistoryReply<HistoryRestored>>
    check(operationId: string): Promise<HistoryReply<HistoryRestored>>
    /** Record a restored Estate as the one to open, then restart. */
    open(estateId: string): Promise<{ ok: boolean; reason: string | null }>
  }
  favourites: {
    /** Project ids the operator pinned, in the order they pinned them. Local to
     *  this machine and deliberately not journalled (M120). */
    list(): Promise<string[]>
    /** The pins as they now stand on disk, and whether the toggle landed. It
     *  used to return the value it HOPED had been written (S14). A pin that
     *  would be the sixth comes back with `atLimit` and nothing written. */
    toggle(projectId: string): Promise<PinResult>
    /** Release one and pin another as ONE write (SCN-043 step 2). Two writes
     *  would leave a window with four pinned and lose the released one if the
     *  second failed. */
    replace(release: string, add: string): Promise<PinResult>
    /** The order of the projects that are not pinned; empty until an arrow is pressed. */
    order(): Promise<string[]>
    /** One step up or down (SCR-30/SCR-01). `rest` is the unpinned ids as the screen
     *  shows them; a pinned project moves among the pins. */
    move(projectId: string, dir: 'up' | 'down', rest: string[]): Promise<ArrangeResult>
  },
  /**
   * The first run and the start paths (ADR-0100). Every folder read here is one the operator chose
   * in this window's native picker (`chooseFolder`); anything else is refused as outside.
   */
  start: {
    /**
     * The native folder picker for ONE folder. 'project' and 'scan' open it to this window; 'parent'
     * only lets this window create one new folder inside it. Null when cancelled.
     */
    chooseFolder(purpose: 'project' | 'scan' | 'parent', defaultPath?: string): Promise<string | null>
    /** Facts about one chosen folder, with the projects that already hold it. */
    inspect(folder: string): Promise<import('./startPaths.ts').FolderView>
    /** Scan a chosen parent folder; bounded, cancellable, never creates anything. Kept as the last scan. */
    scan(root: string): Promise<import('./startPaths.ts').ScanView>
    cancelScan(): Promise<void>
    /** The last completed scan, re-marked against today's projects; null when none was kept. */
    lastScan(): Promise<import('./startPaths.ts').ScanView | null>
    /** Create a new project's folder under a chosen parent, optionally as a git repository. */
    createFolder(input: import('./startPaths.ts').NewFolderInput): Promise<import('./startPaths.ts').NewFolderResult>
    /** Which coding agents this machine can run. */
    executors(): Promise<import('./startPaths.ts').ExecutorRow[]>
  }
  persona: {
    /** Fabric's look on this machine (SCR-36). */
    read(): Promise<PersonaRead>
    /** Keep a look. It changes how Fabric looks, never what it may do. */
    save(next: import('./persona.ts').Persona): Promise<PersonaWrite>
  },
  search: {
    /** One field across every project. Grouped by store, never merged: a ranked
     *  hit and a substring hit are different promises (M141). */
    run(query: string): Promise<SearchGroup[]>
  },
  digest: {
    /** What happened while the operator was away. Composed from stores, never
     *  generated: every line carries the row that opens it (M133). */
    read(projectId: string): Promise<Digest>
    /**
     * Advance the mark to the boundary of a reading that was DISPLAYED.
     *
     * Called when the operator leaves a project, so returning shows what they
     * missed and returning twice shows nothing. The boundary comes from the
     * reading rather than from the journal's head at this moment (UX28-03):
     * the panel re-reads whenever the mark moves, so asking the journal here
     * acknowledged the events that had caused the re-read.
     */
    seen(projectId: string, boundary: number): Promise<void>
  }
  estate: {
    /** What has been done here, and for how long (M131). Counts from the
     *  record; the portrait and the name are not data and are not here. */
    summary(): Promise<EstateSummary>
  },
  harness: {
    /** What a session in this project is given: which agents can run here,
     *  what each may be launched as, the ONE server it can reach, and the
     *  authority outstanding (M145). */
    read(projectId: string): Promise<Harness>
  },
  diagnostics: {
    /** What the PROGRAM did, as distinct from what happened to the estate
     *  (M81). Reading it needs no terminal, which is the whole point: "help us
     *  find the problem" is not a request to open a log file. */
    read(query?: { level?: OpsLevel; limit?: number }): Promise<DiagnosticsView>
  },
  ops: {
    /** A renderer failure, reported to the main process's ops log so it is
     *  recorded beside the program's own rather than lost in a console a
     *  packaged app does not have (audit 2026-10-05 A7-009). Fire-and-forget:
     *  the boundary that sends this has a window to keep standing. */
    rendererError(info: RendererErrorInfo): void
  },
  decisions: {
    /** What this project has decided, and what each decision replaced (M144).
     *  A list rather than a diagram: the only edge the data carries is
     *  `supersedes`, and this estate has none among decisions yet. */
    /** Decision lineages, and whether the batch they were built from was cut
     *  short (M173). A lineage from a truncated read has holes it cannot see. */
    list(projectId: string): Promise<DecisionList>
  },
  runs: {
    /**
     * What is happening right now, for one session (M189).
     *
     * The claim and the observation are SEPARATE fields and are never merged
     * into one status: the agent's own account and what Fabric watched are
     * different kinds of fact (ADR-0008), and one badge turns "it says it is
     * verifying" into "it is verifying".
     *
     * Nothing is derived here that is not already derived for the observer —
     * a second derivation would drift from the one recorded in the journal.
     */
    status(sessionId: string): Promise<ReadEnvelope<import('./runStatus.ts').RunStatusView>>
  }
  memory: {
    /**
     * What the NEXT agent would be told, without starting one (M191).
     *
     * The only way to see a context pack used to be to launch a session. This
     * appends nothing and spawns nothing, and it calls the same compile the
     * launch does — a preview that re-implemented the selection would drift
     * from the thing it previews.
     */
    preview(projectId: string, budget?: number): Promise<PackPreview>
    /** The four stores, each honest about whether it could be READ (M135) —
     *  a store that failed says so rather than showing zero. */
    overview(projectId: string): Promise<MemoryOverview>
    /** The questions memory could not answer: a backlog of things nobody has
     *  written down yet, not an error list. */
    misses(projectId: string, limit?: number): Promise<MemoryMiss[]>
    remember(
      projectId: string,
      claim: string,
      sourceRef?: string,
      /** The fact this replaces. Its window closes; it is never removed — and
       *  the correction may not land: read `correction_outcome` off the
       *  returned row rather than assuming this argument took effect. */
      supersedes?: string,
      /** The SUBJECT as a stable key, normalised by `normaliseAbout` (M182). */
      about?: { namespace?: string; key?: string } | null,
      /** Whose lesson it is. An unknown one defaults rather than passing a
       *  misspelling into a closed column. */
      category?: string
    ): Promise<MemoryFact>
    /**
     * The review path a finding has never had (M154).
     *
     * A page, its cursor, and per-source receipts — NOT a list of claims. The
     * envelope names every relation it could not read, because a repeat count
     * produced by our own outage is a claim about the estate.
     */
    retro(query: Partial<RetroQuery>): Promise<ReadEnvelope<RetroPage>>
    search(
      projectId: string,
      query: string,
      includeSuperseded?: boolean,
      /** One category, or nothing for all of them. An unknown value is IGNORED
       *  rather than applied — filtering by a category nothing can hold returns
       *  an empty list that reads as "there is nothing here". */
      category?: string
    ): Promise<MemoryFact[]>
  }
  terminal: {
    options(): Promise<LaunchOption[]>
    memoryBackends(): Promise<MemoryBackendOption[]>
    /** `permissionMode` is chosen per launch. A blocked mode is REFUSED here,
     *  not merely hidden in the picker — a picker is a suggestion. */
    open(
      projectId: string,
      optionId: string,
      firstInstruction?: string,
      permissionMode?: string | null
    ): Promise<TerminalSession>
    list(projectId?: string): Promise<TerminalSession[]>
    /** The latest self-report per session in a project. Claims, not observations. */
    claims(projectId: string): Promise<AgentClaim[]>
    /** What this session did, from the journal: its own claims and what Fabric
     *  observed, in one ordered list (SCR-39). */
    history(sessionId: string): Promise<FeedEvent[]>
    get(sessionId: string): Promise<TerminalSession | null>
    /** The whole retained buffer for one session, for a view attaching to it.
     *  `written` says which character count the text ends at, so a subscriber
     *  that started first can drop what this answer already contains rather
     *  than losing those bytes or writing them twice (FA-08). */
    scrollback(sessionId: string): Promise<{ text: string; written: number } | null>
    write(sessionId: string, data: string): void
    resize(sessionId: string, cols: number, rows: number): void
    /** Ends a running session; the record stays on the board with its exit code. */
    end(sessionId: string, options?: { force?: boolean }): Promise<TerminalStopResult>
    /** Removes an already-ended session from the board. */
    dismiss(sessionId: string): Promise<void>
    /** `written` is the session's character count after this chunk. */
    onData(cb: (sessionId: string, data: string, written: number) => void): () => void
    onExit(cb: (sessionId: string, exitCode: number) => void): () => void
  }
  windows: {
    openSession(sessionId: string): Promise<void>
    openFile(filePath: string): Promise<void>
  }
  meta: {
    info(): Promise<{
      estateId: string
      estateName: string
      /** Set when this window is a detached session window. */
      sessionId: string | null
      /** Set when this window is a detached file-editor window. */
      filePath: string | null
      /**
       * WHICH BUILD THIS IS, read from the artifact and never from git at
       * runtime (S07). Null when the build carries no manifest — a dev run, or
       * one made before this existed — and `buildLine` says so rather than the
       * surface presenting an absence as a version.
       */
      build: BuildManifest | null
      buildLine: BuildLine
      /** Whether this build may work against this estate, and why. `unknown`
       *  is its own answer: a manifest that will not read and a database that
       *  will not answer are different failures. */
      compatibility: CompatibilityVerdict
    }>
  }
}

export const IPC = {
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsUpdateSettings: 'projects:update-settings',
  projectsSaveSettings: 'projects:save-settings',
  draftsRead: 'drafts:read',
  draftsSave: 'drafts:save',
  ceoStatus: 'ceo:status',
  ceoCall: 'ceo:call',
  ceoSelect: 'ceo:select',
  historyList: 'history:list',
  historyExport: 'history:export',
  historyChoose: 'history:choose',
  historyRestore: 'history:restore',
  historyCheck: 'history:check',
  historyOpen: 'history:open',
  projectsList: 'projects:list',
  projectsStats: 'projects:stats',
  transcriptsList: 'transcripts:list',
  transcriptsGet: 'transcripts:get',
  contextPast: 'context:past',
  projectsRepoStates: 'projects:repo-states',
  /**
   * M107 — main→renderer, and a SEPARATE NAME on purpose. The watcher used to
   * broadcast on `projects:repo-states`, the same name `ipcMain.handle` answers
   * on: one channel, two protocols, and a reader with no way to tell which
   * message it was holding. Nothing listened, so nothing noticed.
   */
  projectsRepoChanged: 'projects:repo-changed',
  quotaRead: 'quota:read',
  runsStatus: 'runs:status',
  memoryPreview: 'memory:preview',
  memoryRetro: 'memory:retro',
  tasksStart: 'tasks:start',
  tasksStartExisting: 'tasks:startExisting',
  tasksList: 'tasks:list',
  tasksMove: 'tasks:move',
  tasksClose: 'tasks:close',
  tasksDetail: 'tasks:detail',
  tasksNote: 'tasks:note',
  tasksPromote: 'tasks:promote',
  tasksBrief: 'tasks:brief',
  attentionList: 'attention:list',
  boardQuery: 'board:query',
  boardResolved: 'board:resolved',
  boardDeferred: 'board:deferred',
  boardDefer: 'board:defer',
  boardReopen: 'board:reopen',
  boardAddTopic: 'board:add-topic',
  releasesList: 'releases:list',
  releasesRecord: 'releases:record',
  releasesVerify: 'releases:verify',
  questionAnswer: 'question:answer',
  goalsList: 'goals:list',
  goalsDefine: 'goals:define',
  tasksPrioritise: 'tasks:prioritise',
  /** M134 — an idea is a card a person filed before it was work. */
  /** M127 — what the machine gateway offers. Never its key. */
  gatewayOffer: 'gateway:offer',
  workspaceState: 'workspace:state',
  workspaceChoose: 'workspace:choose',
  workspaceDecline: 'workspace:decline',
  workspaceCheck: 'workspace:check',
  workspaceImport: 'workspace:import',
  tabsRead: 'tabs:read',
  tabsWrite: 'tabs:write',
  automationsRead: 'automations:read',
  proposalDecide: 'proposal:decide',
  routinesList: 'routines:list',
  routinesDefine: 'routines:define',
  routinesSetEnabled: 'routines:setEnabled',
  agentsList: 'agents:list',
  agentsCreate: 'agents:create',
  tasksFileIdea: 'tasks:fileIdea',
  /** M134 — research SPAWNS a task from the idea; the idea does not move. */
  tasksResearch: 'tasks:research',
  reposList: 'repos:list',
  reposChoose: 'repos:choose',
  reposAttach: 'repos:attach',
  reposDetach: 'repos:detach',
  filesList: 'files:list',
  filesRead: 'files:read',
  filesWrite: 'files:write',
  filesRequestOverwrite: 'files:request-overwrite',
  filesOpenExternally: 'files:open-externally',
  filesRecoveryKeep: 'files:recovery-keep',
  filesRecoveryFlush: 'files:recovery-flush',
  filesRecoveryRead: 'files:recovery-read',
  windowsOpenFile: 'windows:open-file',
  settingsRead: 'settings:read',
  settingsWrite: 'settings:write',
  terminalMemoryBackends: 'terminal:memory-backends',
  feedReplay: 'feed:replay',
  attentionGrant: 'attention:grant',
  analyticsStatus: 'analytics:status',
  analyticsSetEnabled: 'analytics:set-enabled',
  hubOverview: 'hub:overview',
  hubDecide: 'hub:decide',
  hubRevokeGrant: 'hub:revoke-grant',
  hubRevokeAgent: 'hub:revoke-agent',
  hubClearDenial: 'hub:clear-denial',
  hubConnect: 'hub:connect',
  hubDisconnect: 'hub:disconnect',
  favouritesList: 'favourites:list',
  favouritesToggle: 'favourites:toggle',
  favouritesReplace: 'favourites:replace',
  favouritesOrder: 'favourites:order',
  favouritesMove: 'favourites:move',
  startChooseFolder: 'start:choose-folder',
  startInspect: 'start:inspect',
  startScan: 'start:scan',
  startCancelScan: 'start:cancel-scan',
  startLastScan: 'start:last-scan',
  startCreateFolder: 'start:create-folder',
  startExecutors: 'start:executors',
  personaRead: 'persona:read',
  personaSave: 'persona:save',
  searchRun: 'search:run',
  digestRead: 'digest:read',
  digestSeen: 'digest:seen',
  memoryOverview: 'memory:overview',
  memoryMisses: 'memory:misses',
  decisionsList: 'decisions:list',
  harnessRead: 'harness:read',
  diagnosticsRead: 'diagnostics:read',
  estateSummary: 'estate:summary',
  terminalHistory: 'terminal:history',
  memoryRemember: 'memory:remember',
  memorySearch: 'memory:search',
  terminalOptions: 'terminal:options',
  terminalOpen: 'terminal:open',
  terminalList: 'terminal:list',
  terminalClaims: 'terminal:claims',
  terminalGet: 'terminal:get',
  terminalScrollback: 'terminal:scrollback',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalEnd: 'terminal:end',
  terminalDismiss: 'terminal:dismiss',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  windowsOpenSession: 'windows:open-session',
  metaInfo: 'meta:info',
  opsRendererError: 'ops:renderer-error'
} as const
