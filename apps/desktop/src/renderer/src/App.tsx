import { useCallback, useEffect, useRef, useState } from 'react'
import type { LinkNotice, LinkRoute } from '../../shared/linkRoute.ts'
import { receiveLink, releaseLink, type LinkGate } from './linkArrival'
import type { StringKey } from './i18n/en.ts'

/** What a `fabric://` link's notice says (SCN-142). */
const LINK_NOTICE_KEY: Record<LinkNotice, StringKey> = {
  'conversation-soon': 'links.notice.conversation-soon',
  'start-session': 'links.notice.start-session',
  'link-refused': 'links.notice.link-refused',
  'project-unknown': 'links.notice.project-unknown',
  'service-unknown': 'links.notice.service-unknown',
  'service-in-no-project': 'links.notice.service-in-no-project',
  'service-in-many-projects': 'links.notice.service-in-many-projects',
  'link-unreadable': 'links.notice.link-unreadable'
}
import { NO_MARKS, advance, type FeedMarks } from '../../shared/feedMarks.ts'
import { APP_SETTINGS_DEFAULTS } from '../../shared/types'
import type { AppSettings, FeedEvent, ProjectRow, Quota, SettingsPatch, TerminalSession } from '../../shared/types'
import type { CommsHead } from '../../shared/commsRead.ts'
import { unreadOf } from './launch/commsList'
import { restoreTabs, toPersist } from '../../shared/tabs.ts'
import {
  addressKey,
  focusFor,
  focusSurvives,
  revealAt,
  routeToEntity,
  routeToProject,
  scrollKeyOf,
  withoutAddress,
  type AppRoute,
  type Tab
} from '../../shared/appRoute.ts'
import { closePanel, togglePanel, type SidePanel } from './sidePanel'
import { taskOf, type EntityRef } from '../../shared/entityRef.ts'
import { EditorWindow } from './EditorWindow'
import { EstateHome } from './EstateHome'
import { mergeDraft, type TaskDraft } from '../../shared/taskDraft.ts'
import { BoardScreen } from './launch/BoardScreen'
import { GraphScreen } from './launch/GraphScreen'
import { CommsScreen } from './launch/CommsScreen'
import { PersonaProvider } from './launch/persona'
import { PlanScreen } from './launch/PlanScreen'
import { PulseScreen } from './launch/PulseScreen'
import { ReleasesScreen } from './launch/ReleasesScreen'
import { PersonaScreen } from './launch/PersonaScreen'
import { GuideScreen, HelpScreen } from './launch/HelpScreens'
import { markOf } from '../../shared/feedMarks.ts'
import { CeoChat } from './CeoChat'
import { PrivateHistoryPanel } from './PrivateHistoryPanel'
import { AgentAccessPanel } from './AgentAccessPanel'
import { SettingsScreen } from './launch/SettingsScreen'
import { BoardPanel } from './BoardPanel'
import { SearchPanel } from './SearchPanel'
import { EstateAgents } from './EstateAgents'
import { WhereWorkScreen } from './launch/WhereWorkScreen'
import { Banner, Button } from './components'
import { StackHealthNotice } from './StackHealthNotice'
import { I18nProvider, useT, type Locale } from './i18n'
import { LaunchShell, machineOf, PROJECT_SECTION_ANCHOR, revealSection, type ProjectSection, type RailPlace } from './launch/LaunchShell'
import { ActLine, latestPersonAct } from './launch/ActLine'
import { HistoryScreen } from './launch/HistoryScreen'
import { JoinedAgents } from './launch/JoinedAgents'
import { AgentsAtWork } from './launch/HomeWork'
import { lastActivityOf } from '../../shared/railProjects.ts'
import './launch/launch.css'
import { Onboarding } from './Onboarding'
import { FirstRun, firstRunDue } from './start/FirstRun'
import { StartScreen, errorText, explainError } from './start/StartPaths'
import './start/start.css'
import { BootFailure, OperatorError } from './OperatorError'
import { draftNotKept } from './draftNotKept'
import { ProjectHome } from './ProjectHome'
import { SessionWindow } from './SessionWindow'
import { ConsoleTabs } from './launch/ConsoleTabs'
import { runnerLabel } from './runnerLabel'
import {
  OpenConsoleContext,
  consoleTitleOf,
  neighbourOf,
  prunedConsoles,
  readOpenConsoles,
  withConsole,
  withoutConsole,
  writeOpenConsoles
} from './consoles'
import { Workspace } from './Workspace'

const FEED_POLL_MS = 2000 // ADR-0027: the table is the record; polling replay is the v1 wake-up
const SESSION_POLL_MS = 3000
/** The rail badge's own clock (SCN-143, the unread slice): slower than the screen's poll —
 *  the badge says "something new is there", the screen itself reads live once open. */
const COMMS_BADGE_POLL_MS = 5000

/** An onboarding draft. It lives in the shell rather than in the form, so
 *  switching tabs and coming back finds the work still there — a draft is lost
 *  only when the operator closes its tab, and then only after confirming. */
// ONE DECLARATION (R-005, AX-05). `Draft` and `EMPTY_DRAFT` moved to
// `shared/onboardingDraft.ts` when the draft became durable: the main process
// validates the file on its way to disk and cannot import a renderer module, so
// a shape both processes need lives in `shared`. Re-exported here because this
// is where every consumer already imports it from.
import { EMPTY_DRAFT, mayPersist, type Draft } from '../../shared/onboardingDraft.ts'

// Re-exported because this is where every consumer already imports them from.
// A bare `export … from` does not bring the name into THIS module's scope, and
// four uses below need it — the compiler said so at each one.
export type { Draft }
export { EMPTY_DRAFT }

const draftIsDirty = (d: Draft): boolean =>
  d.name.trim() !== '' || d.purpose.trim() !== '' || d.repoPaths.length > 0

/** The default estate's name as `supabase/seed.sql` writes it. */
const SEED_ESTATE_NAME = 'org #1'

export function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.fabric.settings
      .read()
      .then(setSettings)
      .catch((e) => {
        console.error('settings read failed, using defaults:', e)
        setSettings(APP_SETTINGS_DEFAULTS)
      })
  }, [])

  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    const apply = (): void => {
      const dark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings?.theme])

  // The document says which language the app speaks, so the crash screen (outside this provider, in
  // `main.tsx`) speaks it too when the provider itself is what failed (0.3.2 verification UX-8).
  useEffect(() => {
    if (settings?.locale) document.documentElement.lang = settings.locale
  }, [settings?.locale])

  if (!settings) return <div className="booting" />
  return (
    <I18nProvider locale={settings.locale as Locale}>
      <PersonaProvider>
      <Shell settings={settings} onSettings={setSettings} />
      </PersonaProvider>
    </I18nProvider>
  )
}

function Shell({
  settings,
  onSettings
}: {
  settings: AppSettings
  onSettings: (s: AppSettings) => void
}): React.JSX.Element {
  const t = useT()
  const [sessionWindowId, setSessionWindowId] = useState<string | null | undefined>(undefined)
  const [fileWindowPath, setFileWindowPath] = useState<string | null>(null)
  // #region main-window-boot — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
  /** Known only once `meta.info` has answered. The drafts and the working set are the main window's
   *  (CO-091): a detached session or editor window is not given them, so it must not ask. */
  const isMainWindow = sessionWindowId === null && !fileWindowPath
  // #endregion main-window-boot
  const [estateName, setEstateName] = useState('')
  /** NULL until the list has been read (M108). `[]` is an answer — "this estate
   *  holds no projects" — and it was the value every launch started with, so the
   *  first screen told the operator a fact nobody had measured. */
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  /** The last read of the list failed: said in the rail in place of the list, the last list kept (SCN-162). */
  const [projectsProblem, setProjectsProblem] = useState<string | null>(null)
  const [projectsReadAt, setProjectsReadAt] = useState<string | null>(null)
  /** The person's pinned projects, in their order: the rail lists them first (SCN-162 step 2). */
  const [pins, setPins] = useState<string[]>([])
  /** What waits for the person, over the whole board and by project; null while unknown (SCN-162: a count is a claim). */
  const [waiting, setWaiting] = useState<{ total: number; byProject: Record<string, number> } | null>(null)
  /** The journal's high-water mark when the person came to the place on screen: the act line shows acts after it. */
  const [placeSince, setPlaceSince] = useState(0)
  const [tabs, setTabs] = useState<Tab[]>([])
  /** The open consoles along the top (OF-03, SCN-172), in the order they were opened; kept for a reload of this window
   *  only (`consoles.tsx#readOpenConsoles`), because a session does not outlive the app. */
  const [consoles, setConsoles] = useState<string[]>(() => readOpenConsoles())
  /** Sessions some list has held: a tab is dropped when its session leaves the list, never before it first arrives. */
  const seenSessions = useRef(new Set<string>())
  // #region saved-tabs-read-authority — docs: docs/handoffs/ad02-native-20261004/README.md#write-authority
  /** Claims the one-time read; an in-flight read is not write authority. */
  const restored = useRef(false)
  const [tabsRestored, setTabsRestored] = useState(false)
  // #endregion saved-tabs-read-authority
  // ONE value. It used to be a `Tab` with a boolean `showAgents` beside it, and
  // two booleans side by side have four states of which two are nonsense: a
  // click that opened a project while the agents view was up changed the tab
  // strip and left the agents list on screen (`appRoute.ts`).
  const [active, setActive] = useState<AppRoute>({ kind: 'home' })
  const [workspaceFor, setWorkspaceFor] = useState<string | null>(null)
  /** Null until read (M108) — `[]` says "nothing is running", which is a
   *  measurement, and it was the value every launch started with. */
  const [sessions, setSessions] = useState<TerminalSession[] | null>(null)
  const [feed, setFeed] = useState<FeedEvent[] | null>(null)
  /** The board's threads for the rail badge. Null until the first confirmed answer;
   *  a failed poll keeps the last confirmed list — the badge keeps its count rather
   *  than zeroing, because zero is a true answer and silence is not (SCN-143). */
  const [commsHeads, setCommsHeads] = useState<{ heads: CommsHead[]; truncated: boolean } | null>(null)
  /** M83 via M113 — the account's windows, which are an ESTATE fact. Null when
   *  there is nothing to say: not signed in is an answer, not an error. */
  /**
   * THREE STATES, not two (AX-14). `null` used to mean both "the reader had
   * nothing to say" and "nobody has looked yet" — and the estate panel rendered
   * the first sentence for both, diagnosing the operator's machine on its very
   * first paint. A failed read joined them through the catch below.
   */
  const [error, setError] = useState<string | null>(null)
  /** The journal on this computer's stack did not answer: the rail's foot line, apart from other errors (UX-10). */
  const [journalFailed, setJournalFailed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  /** Search, the conversation with Fabric (SCR-64), private history (SCR-65) and Agent access (SCR-76):
   *  ONE side panel at a time, held in one state (UX-13). */
  const [panel, setPanel] = useState<SidePanel>(null)
  const panelOpen = useRef(false)
  panelOpen.current = panel !== null
  const chatOpen = panel === 'chat'
  const historyOpen = panel === 'history'
  const accessOpen = panel === 'access'
  const searchOpen = panel === 'search'
  /** An example from Help put in the composer (SCR-44); null when the chat is opened plainly. */
  const [chatSuggestion, setChatSuggestion] = useState<string | null>(null)
  const openChat = (suggestion: string | null): void => {
    setChatSuggestion(suggestion)
    setPanel('chat')
  }
  /**
   * What a panel asked to be shown, addressed to one project and CONSUMED when
   * that project's screen honours it.
   *
   * It used to be handed to a screen that was not mounted — the agents overlay
   * was covering it — so nothing consumed the request and nothing cleared it.
   * It fired minutes later, when the operator toggled the overlay off from
   * somewhere else, and jumped them to a task they had forgotten asking for.
   */
  /**
   * The address ALREADY revealed at this visit — a latch, not a second copy of
   * it (AX-05).
   *
   * Every navigation resets it, so arriving at the same entity from two search
   * hits reveals twice: a visit is not the address. Without the latch a
   * re-render would drag the operator back to the task they had since scrolled
   * away from, which is the "haunting" this module's header names.
   */
  const [honoured, setHonoured] = useState<string | null>(null)
  /** The instruction being typed, per project. It has to live ABOVE the remount
   *  above, or switching tabs would throw it away — and it has to be per
   *  project, or it would follow the operator into the wrong one and be run
   *  there. Both halves are UX-01. */
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  /** Whether the drafts on disk have been read, so the first persist cannot
   *  write an empty set over them (AX-05). */
  const [draftsLoaded, setDraftsLoaded] = useState(false)
  // #region initial-draft-snapshot — docs: docs/handoffs/ad02-native-20261004/README.md#write-authority
  const initialDraftRead = useRef<ReturnType<typeof window.fabric.drafts.read> | null>(null)
  const readInitialDrafts = useCallback(() => {
    // Hydration and tab restoration must use one snapshot, including failure.
    // Two reads can disagree about which saved draft identities are readable.
    initialDraftRead.current ??= Promise.resolve().then(() => window.fabric.drafts.read())
    return initialDraftRead.current
  }, [])
  // #endregion initial-draft-snapshot


  /**
   * READ THE DRAFTS ONCE, before anything can write over them (AX-05).
   *
   * `draftsLoaded` exists because the persist effect below runs on every change
   * to `drafts` — including the initial empty object. Without the flag the
   * first render would write `{}` over a file holding the operator's
   * half-described project, which is the loss this whole change removes,
   * reintroduced by the fix for it.
   *
   * A failed read is REPORTED and leaves the drafts empty rather than silently
   * looking like an operator who had none — but it also leaves `draftsLoaded`
   * false, so nothing overwrites a file we could not read.
   */
  useEffect(() => {
    if (!isMainWindow) return
    let alive = true
    void readInitialDrafts()
      .then((answer) => {
        if (!alive) return
        // Hydration may finish after the operator has already opened and typed
        // into a new draft. Those fresh identities belong to this window.
        setDrafts((current) => ({ ...answer.drafts, ...current }))
        // ONLY when the value is the operator's own. `recovered` counts —
        // writing it back repairs a file that would not parse — and
        // `unreadable` does NOT: that value is a default standing in for
        // something nobody could read, and persisting it destroys the draft.
        //
        // The first version called `setDraftsLoaded(true)` unconditionally
        // while its own comment claimed otherwise, and the probe below caught
        // it: an unreadable file was overwritten with an empty set on the very
        // next effect.
        if (mayPersist(answer.status)) setDraftsLoaded(true)
        if (answer.problem) setError(answer.problem)
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [readInitialDrafts, isMainWindow])

  /**
   * Persist on change, and say so when it does not land.
   *
   * The save returns its result because `localStore` refuses to pretend: a
   * draft the operator believes is safe and which silently failed to write is
   * worse than one they know is not. A CONFLICT — another window typing into
   * the same file — is reported rather than counted as saved.
   */
  useEffect(() => {
    if (!draftsLoaded) return
    void window.fabric.drafts
      .save(drafts)
      .then((answer) => {
        if (!answer.saved && answer.reason) setError(`the draft was not saved: ${answer.reason}`)
      })
      .catch((e) => setError(String(e)))
  }, [drafts, draftsLoaded])
  const lastSeq = useRef(0)
  const draftStarted = useRef(false)
  // The feed is capped at 500 for the display. Panels that need to know
  // "something happened" watched `feed.length`, which stops changing at the cap —
  // so after 500 events the claims, statistics and repository panels froze
  // permanently while the observed badge kept refreshing every three seconds.
  // A monotonic high-water mark cannot stop changing (M42).
  // FA-08 — one mark per event family rather than one for the journal. A
  // heartbeat used to wake thirteen readers; now it wakes the ones that read
  // agents. `marks.all` is still there for readers that genuinely span it.
  const [marks, setMarks] = useState<FeedMarks>(NO_MARKS)
  // A tick that outlives its interval used to overlap the next one: both read the
  // same `lastSeq` and the same events rendered twice, with duplicate keys.
  const ticking = useRef(false)

  const refreshProjects = useCallback(async () => {
    let loaded: ProjectRow[]
    try {
      loaded = await window.fabric.projects.list()
    } catch (e) {
      // Said in the rail, the last list kept beneath it with its time; the five places stay usable (SCN-162).
      setProjectsProblem(explainError(e, t))
      return
    }
    setProjects(loaded)
    setProjectsProblem(null)
    setProjectsReadAt(new Date().toISOString())
    // M111 — restore the working set ONCE, and only when it is known which
    // projects still exist. Restoring before that would reopen tabs for
    // projects that are gone and then have to take them away again.
    if (!restored.current) {
      restored.current = true
      try {
        const saved = await window.fabric.tabs.read()
        // The drafts on disk decide which draft tabs come back: a tab is
        // restored only if the thing it names still exists, which is one rule
        // for both kinds (AX-05).
        const onDisk = await readInitialDrafts()
        // #region unreadable-draft-working-set — docs: docs/handoffs/ad02-native-20261004/README.md#write-authority
        // An unreadable draft set cannot prove a saved tab's subject is gone.
        // Keep its working set on disk; the draft reader reports the failure.
        if (onDisk.status === 'unreadable') return
        // #endregion unreadable-draft-working-set
        const r = restoreTabs(saved, loaded.map((p) => p.id), Object.keys(onDisk.drafts))
        if (r.tabs.length) setTabs((current) => [
          ...r.tabs.filter((saved) => !current.some((tab) => keyOf(tab) === keyOf(saved))),
          ...current
        ])
        if (!draftStarted.current && r.active.kind !== 'home') setActive(r.active)
        // Dropped tabs are SAID. Quietly reopening four of five is how an
        // operator concludes they closed one themselves.
        if (r.dropped.length) setError((current) => [current, t('tabs.dropped', { count: r.dropped.length })].filter(Boolean).join(' · '))
        setTabsRestored(true)
      } catch {
        // A working set that cannot be read is not a reason to fail to start.
      }
    }
  }, [readInitialDrafts])
  const refreshSessions = useCallback(async () => {
    setSessions(await window.fabric.terminal.list())
  }, [])

  useEffect(() => {
    window.fabric.meta
      .info()
      .then((m) => {
        setEstateName(m.estateName)
        setFileWindowPath(m.filePath)
        setSessionWindowId(m.sessionId)
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (sessionWindowId !== null || fileWindowPath) return
    let stop = false
    const tick = async (): Promise<void> => {
      if (ticking.current) return
      ticking.current = true
      try {
        const events = await window.fabric.feed.replay(lastSeq.current)
        if (stop) return
        // A successful read of an empty journal is a reading — the estate has nothing yet — not "not read":
        // leaving the feed null kept every freshness line on "Reading…" for an estate with no events.
        setJournalFailed(false)
        if (events.length === 0) { setFeed((old) => old ?? []); return }
        lastSeq.current = events[events.length - 1].seq
        setMarks((prev) => advance(prev, events))
        setFeed((old) => [...(old ?? []), ...events].slice(-500))
        if (events.some((e) => e.type.startsWith('project.'))) void refreshProjects()
        if (events.some((e) => e.type.startsWith('terminal.'))) void refreshSessions()
        // A draft restored from История (wave 2's `draft.restore`): its words are back on disk; take them in.
        if (events.some((e) => e.type === 'act.recorded@1' && (e.payload as { kind?: unknown }).kind === 'draft.restore')) draftsRestoredRef.current(false)
      } catch (e) {
        // The same failure every two seconds would make the banner impossible to
        // dismiss; raise it once and keep quiet until something changes.
        const message = String(e)
        setJournalFailed(true)
        setError((prev) => (prev === message ? prev : message))
      } finally {
        ticking.current = false
      }
    }
    void tick()
    const h = setInterval(tick, FEED_POLL_MS)
    return () => {
      stop = true
      clearInterval(h)
    }
  }, [sessionWindowId, refreshProjects, refreshSessions])

  // #region comms-unread — docs: docs/ux/screens.md#scr-81-project-comms
  // The Comms rail badge: one bounded read on its own clock, whether or not the screen
  // is open — "the operator sees that agents wrote" must not require opening Comms first.
  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        // Each thread's id and last seq only, capped by the board (wave 4): never every thread at once.
        const reply = await window.fabric.comms.heads()
        if (alive && reply.ok) setCommsHeads({ heads: reply.heads, truncated: reply.truncated })
      } catch {
        // keep the last confirmed list; the badge doctrine above
      }
    }
    void tick()
    const h = setInterval(() => void tick(), COMMS_BADGE_POLL_MS)
    return () => { alive = false; clearInterval(h) }
  }, [])

  /** Threads with a message newer than this operator's read mark (SCN-143, the unread
   *  slice), from the heads. Null while the board has never answered — no badge is shown then,
   *  because a badge is a claim and an unanswered board makes none. When the board cut the heads
   *  at its cap the count is a floor, said "5000+" — never a smaller number (W4-3). */
  const commsUnread = unreadOf(commsHeads, settings.commsReadThrough)

  /** Merge read marks from Comms, field-scoped — the A7-008 rule the feed's onRead states:
   *  a window writes the one field it owns, never a whole-settings copy read at start. */
  const onCommsRead = async (marks: Record<string, number>) => {
    const written = await window.fabric.settings
      .write({ commsReadThrough: { ...settings.commsReadThrough, ...marks } })
      .catch((e: unknown) => {
        setError(t('settings.notSaved', { reason: explainError(e, t) }))
        return null
      })
    if (!written) return
    onSettings(written.settings)
    if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
  }
  // #endregion comms-unread

  useEffect(() => {
    if (sessionWindowId !== null || fileWindowPath) return
    void refreshProjects()
    void refreshSessions()
    // CO-392 (D-3): the window reads no account quota; quotas are Switchboard's, and the main process reads its own only
    // before an unattended start (main/routineTick.ts, main/chainAdvance.ts).
    const h = setInterval(() => void refreshSessions(), SESSION_POLL_MS)
    return () => { clearInterval(h) }
  }, [sessionWindowId, refreshProjects, refreshSessions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Escape leaves Settings only from the screen itself: never from a field being typed in, and never while a panel
      // opened from Settings is up (0.3.6 review i2 UX-2).
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      if (e.key === 'Escape' && !typing && !panelOpen.current) setShowSettings(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // M106a — the diagnosis used to be UNREACHABLE. `meta.info()` rejecting left
  // `sessionWindowId` at `undefined`, and this early return sits ABOVE the
  // error banner in the tree: `setError` ran, the message went into state, and
  // the operator watched an empty rectangle forever with the answer held one
  // branch away. A window that cannot say what it is must still be able to say
  // that, which is why this branch renders rather than returning a bare div.

  // #region fabric-link-open — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
  // A `fabric://` link from a product's button (DEC-0040): main resolved where it opens; the notice says what happened.
  // It waits while the first run is undecided or on screen (linkArrival.ts), and the page claims what opened before it
  // listened, so a link that started Fabric cold is not lost.
  const [linkNotice, setLinkNotice] = useState<LinkNotice | null>(null)
  /** Links that waited past the limit and were not opened, said beside the notice (0.3.5 review i2 ER-7). */
  const [linksDropped, setLinksDropped] = useState(0)
  const heldLink = useRef<LinkRoute | null>(null)
  const linkDecided = useRef(false)
  const activeKind = useRef(active.kind)
  activeKind.current = active.kind
  const applyLink = (r: LinkRoute): void => {
    goTo(r.route.kind === 'project' ? routeToProject(r.route.projectId) : { kind: 'home' })
    setLinkNotice(r.notice)
    setLinksDropped(r.dropped ?? 0)
  }
  const applyLinkRef = useRef(applyLink)
  applyLinkRef.current = applyLink
  const releaseHeld = (how: Parameters<typeof releaseLink>[1]): void => {
    const { apply, offer } = releaseLink(heldLink.current, how)
    heldLink.current = null
    if (apply) applyLinkRef.current(apply)
    // A deep link opens what it links to (ADR-0160 §5): no «open it?» banner after the first run.
    if (offer) applyLinkRef.current(offer)
  }
  useEffect(() => {
    const take = (r: LinkRoute): void => {
      const gate: LinkGate = !linkDecided.current ? 'deciding' : activeKind.current === 'welcome' ? 'first-run' : 'open'
      const { held, apply } = receiveLink(gate, heldLink.current, r)
      heldLink.current = held
      if (apply) applyLinkRef.current(apply)
    }
    const off = window.fabric.links?.onOpen(take)
    window.fabric.links?.pending?.().then((waiting) => waiting.forEach(take), (e) => setError(explainError(e, t)))
    return () => off?.()
    // Subscribing once is the point; what changes is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The first run left by any route — the rail stays visible during it — offers what waited (UX-14). Finishing it
  // releases first (its own onFinish), so this finds nothing held then.
  useEffect(() => {
    if (!linkDecided.current || active.kind === 'welcome' || !heldLink.current) return
    releaseHeld('first-run-left')
    // Only a change of place matters; the rest is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.kind])
  // #endregion fabric-link-open

  // ADR-0100: the first run is shown ONCE, to an estate with no project, and only after both the
  // settings and the project list are known — an unknown list is not an empty one.
  const firstRunOffered = useRef(false)
  useEffect(() => {
    if (firstRunOffered.current || projects === null) return
    firstRunOffered.current = true
    linkDecided.current = true
    if (firstRunDue(settings.firstRun?.completedAt, projects)) {
      activeKind.current = 'welcome'
      goTo({ kind: 'welcome' })
    } else releaseHeld('no-first-run')
  }, [projects, settings.firstRun?.completedAt])

  /** Help's "go" links: the named place, the first run included (ADR-0100). */
  const goFromHelp = (to: 'board' | 'plan' | 'pulse' | 'persona' | 'welcome'): void => setActive({ kind: to })

  // Which section of the open project the operator asked for, so the sidebar marks it (iteration 2).
  const [projectSection, setProjectSection] = useState<ProjectSection>('overview')
  const openProject = (id: string): void => {
    setProjectSection('overview')
    setTabs((old) =>
      old.some((x) => x.kind === 'project' && x.projectId === id)
        ? old
        : [...old, { kind: 'project', projectId: id }]
    )
    // The route is one value, so arriving here LEAVES wherever we were —
    // including the agents view, which no longer has a boolean of its own to
    // forget to clear.
    goTo(routeToProject(id))
    setWorkspaceFor(null)
  }

  /**
   * EVERY navigation goes through here, and that is why the latch cannot be
   * left stale: resetting it is not a step a caller has to remember.
   * (The recurring fix in this codebase — an omission in the CALLER is cured by
   * making it impossible to omit, not by adding another case.)
   */
  const goTo = (route: AppRoute): void => {
    setActive(route)
    setHonoured(null)
  }


  /** Open the exact thing, not the project it happens to live in. */
  const openEntity = (projectId: string, ref: EntityRef): void => {
    // BUILT THROUGH THE RESOLVER. `routeToEntity` refuses an address no surface
    // can focus and hands back where to go instead, so a fact or a transcript
    // opens its project rather than putting a location on screen that nothing
    // can reach.
    const addressed = routeToEntity({ ref, projectId })
    openProject(projectId)
    goTo(addressed.addressed ? addressed.route : addressed.fallback)
    // The way back is ⌘[ (the shell's history below), not a Back of Fabric's own (SCN-162 step 3).
  }

  const newDraft = (): void => {
    draftStarted.current = true
    const id = `draft-${crypto.randomUUID()}`
    setDrafts((old) => ({ ...old, [id]: { ...EMPTY_DRAFT, projectId: crypto.randomUUID() } }))
    setTabs((old) => [...old, { kind: 'draft', id }])
    setActive({ kind: 'draft', id })
    setWorkspaceFor(null)
  }
  /** «Создать проект» (SCN-171): a new draft; the unfinished ones are listed on «Создать» to go on with. */
  const startProject = (): void => {
    setShowSettings(false)
    newDraft()
  }
  // #region discard-at-once — docs: docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md#decision
  const closeTab = (tab: Tab): void => {
    // A filled-in draft is the person's words: discarding it asks nothing (ADR-0160 §1) and is an act with its undo —
    // the main process keeps the words on this computer and records «Черновик убран · Отменить» (wave 2's executor).
    if (tab.kind === 'draft') {
      const d = drafts[tab.id]
      if (d && draftIsDirty(d)) {
        void window.fabric.drafts.discard(tab.id).then(
          (answer) => { if (!answer.ok) setError(draftNotKept(t, answer)) },
          (e: unknown) => setError(draftNotKept(t, e))
        )
      }
      setDrafts((old) => {
        const next = { ...old }
        delete next[tab.id]
        return next
      })
    }
    setTabs((old) => old.filter((x) => keyOf(x) !== keyOf(tab)))
    if (tabOf(active) && keyOf(tabOf(active)!) === keyOf(tab)) setActive({ kind: 'home' })
  }
  /**
   * «Отменить» on a discarded draft put its words back on disk (wave 2's `draft.restore`): read the drafts again and take
   * in the ones this window does not hold, as open drafts; `open` brings the person to it (the act line's undo).
   */
  const draftsRestored = (open: boolean): void => {
    void window.fabric.drafts.read().then((answer) => {
      const back = Object.keys(answer.drafts).filter((id) => !draftsRef.current[id])
      if (!back.length) return
      setDrafts((old) => {
        const next = { ...old }
        for (const id of back) next[id] = answer.drafts[id]
        return next
      })
      setTabs((old) => [...old, ...back.filter((id) => !old.some((x) => x.kind === 'draft' && x.id === id)).map((id) => ({ kind: 'draft' as const, id }))])
      if (open) { setShowSettings(false); setActive({ kind: 'draft', id: back[back.length - 1] }) }
    }, (e: unknown) => setError(explainError(e, t)))
  }
  const draftsRestoredRef = useRef(draftsRestored)
  draftsRestoredRef.current = draftsRestored
  // #endregion discard-at-once
  const replaceDraft = (draftId: string, project: ProjectRow): void => {
    setTabs((old) =>
      old.map((x) => (x.kind === 'draft' && x.id === draftId ? { kind: 'project', projectId: project.id } : x))
    )
    setActive({ kind: 'project', projectId: project.id })
    void refreshProjects()
  }

  // #region saved-tabs-write-authority — docs: docs/handoffs/ad02-native-20261004/README.md#write-authority
  // M111 — written on every change, not on quit. Saved only at the end, a crash
  // after closing four of five tabs would bring all five back.
  useEffect(() => {
    if (!tabsRestored) return
    void window.fabric.tabs.write(toPersist(tabs, active)).catch(() => {})
  }, [tabs, active, tabsRestored])
  // #endregion saved-tabs-write-authority

  // Cmd+W. The menu asks and the renderer decides, because the main process does
  // not know what a tab is and should not.
  //
  // Through a ref rather than a dependency: subscribing on every tab change
  // would add and remove a listener on each keystroke's worth of state, and the
  // handler must always see the CURRENT active tab rather than the one that was
  // in front when the listener was attached.
  const closeTabRef = useRef<() => void>(() => {})
  closeTabRef.current = () => {
    // Cmd+W closes a TAB. The agents view is a place, not a tab: there is
    // nothing there to close, and closing "the active tab" while it is up would
    // shut whichever project happened to be behind it.
    if (active.kind === 'console') { closeConsole(active.sessionId); return }
    const tab = tabOf(active)
    if (tab && tab.kind !== 'home') closeTab(tab)
  }
  // Tabs are the main window's alone (CO-091); a detached window's bridge has no `tabs`.
  useEffect(() => (isMainWindow ? window.fabric.tabs.onCloseActive(() => closeTabRef.current()) : undefined), [isMainWindow])

  const current = active.kind === 'project' ? (projects ?? []).find((p) => p.id === active.projectId) : null
  // ONE SOURCE, read here and nowhere else. The route says where the operator
  // is; the reveal follows from it (AX-05).
  const focus = revealAt(active, honoured)

  // A focus outlives the click that made it. If the operator closed its project
  // meanwhile, honouring it later would reopen a tab they deliberately shut.
  useEffect(() => {
    if (focus && !focusSurvives(focus, tabs.filter((x) => x.kind === 'project').map((x) => x.projectId)))
      setActive((r) => withoutAddress(r))
  }, [tabs, focus])

  // #region rail-wiring — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
  // The rail's facts (SCN-162): the pins, what waits for the person, where an agent works, the latest activity.
  useEffect(() => {
    if (!isMainWindow) return
    let alive = true
    // Read again on every change of place: the home's star writes them, and a pin is a local file read.
    // A pin list that cannot be read keeps the last one: the rail is then ordered by activity alone, said nowhere
    // because nothing is lost (the pins stay on disk) and nothing on the rail claims them.
    window.fabric.favourites?.list().then((p) => { if (alive) setPins(p) }, () => undefined)
    return () => { alive = false }
  }, [active, isMainWindow])
  const boardMark = markOf(marks, ['task', 'work', 'question', 'goal', 'proposal', 'grant', 'policy', 'effect', 'access'])
  useEffect(() => {
    if (!isMainWindow) return
    let alive = true
    // The SAME query the board runs (M151), cut to one row: its total and per-project counts are over the whole board.
    try {
      window.fabric.board.query({ projectId: null, limit: 1 }).then(
        (v) => { if (alive) setWaiting(v.data ? { total: v.data.total, byProject: v.data.countsByProject } : null) },
        () => { if (alive) setWaiting(null) }
      )
    } catch {
      setWaiting(null) // no count rather than a wrong one
    }
    return () => { alive = false }
  }, [boardMark, isMainWindow])
  const liveProjects = new Set((sessions ?? []).filter((x) => x.running).map((x) => x.projectId))
  const lastActivity = lastActivityOf(feed)

  // The act line: the person's acts since they came to the place on screen (ADR-0160 §1, `ActLine.tsx`).
  const placeKey = showSettings ? 'settings' : active.kind === 'project' ? `project:${active.projectId}` : active.kind === 'draft' ? `draft:${active.id}` : active.kind === 'start' ? `start:${active.path}` : active.kind === 'console' ? `console:${active.sessionId}` : active.kind
  useEffect(() => { setPlaceSince(lastSeq.current) }, [placeKey])
  const lineAct = latestPersonAct(feed, placeSince)

  // THE WAY BACK is the system's (SCN-162 step 3): ⌘[ goes back, ⌘] forward, over the places the person was at. No
  // Back button of Fabric's own. A place is the route and whether Settings is in front.
  type Snap = { route: AppRoute; settings: boolean }
  const past = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])
  const shown = useRef<Snap | null>(null)
  const travelling = useRef(false)
  useEffect(() => {
    const snap: Snap = { route: active, settings: showSettings }
    const prev = shown.current
    shown.current = snap
    if (travelling.current) { travelling.current = false; return }
    if (!prev || (prev.settings === snap.settings && JSON.stringify(prev.route) === JSON.stringify(snap.route))) return
    past.current = [...past.current.slice(-49), prev]
    future.current = []
  }, [active, showSettings])
  const travelRef = useRef<(dir: 'back' | 'forward') => void>(() => {})
  travelRef.current = (dir) => {
    const from = dir === 'back' ? past : future
    const to = dir === 'back' ? future : past
    // A project removed since, or a console whose tab the person closed, is skipped rather than shown blank or reopened.
    const known = (r: AppRoute): boolean =>
      r.kind === 'project' ? (projects ?? []).some((p) => p.id === r.projectId)
      : r.kind === 'console' ? consoles.includes(r.sessionId)
      : true
    let snap = from.current.pop()
    while (snap && !known(snap.route)) snap = from.current.pop() // a project removed since is skipped, not shown blank
    if (!snap || !shown.current) return
    to.current.push(shown.current)
    travelling.current = true
    setShowSettings(snap.settings)
    setActive(snap.route)
    setHonoured(null)
  }
  useEffect(() => {
    if (!isMainWindow) return
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || (e.key !== '[' && e.key !== ']')) return
      const el = e.target instanceof HTMLElement ? e.target : null
      // An editor or a console keeps ⌘[ for itself (indent, the program's own keys).
      if (el && (el.isContentEditable || el.closest('.monaco-editor, .xterm'))) return
      e.preventDefault()
      travelRef.current(e.key === '[' ? 'back' : 'forward')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMainWindow])
  // #endregion rail-wiring

  // #region console-tabs-shell — docs: docs/ux/scenarios.md#scn-172-keep-several-consoles-open-as-tabs-along-the-top-and-switch-between-them
  // A console opens INSIDE the main window (OF-03): every "open the console" control asks through `OpenConsoleContext`,
  // which lands here. A second open of a session already open switches to its tab and adds none.
  // Stable (state setters only), so the context's consumers are not handed a new function on every render.
  const openConsole = useCallback((sessionId: string): Promise<void> => {
    setShowSettings(false)
    setWorkspaceFor(null)
    setConsoles((old) => withConsole(old, sessionId))
    setActive({ kind: 'console', sessionId })
    setHonoured(null)
    return Promise.resolve()
  }, [])
  /** Where the person was before the consoles: the newest place in the way back that is not a console. */
  const placeBeforeConsoles = (): AppRoute => {
    for (let i = past.current.length - 1; i >= 0; i--) {
      const r = past.current[i].route
      if (r.kind === 'console') continue
      if (r.kind === 'project' && !(projects ?? []).some((p) => p.id === r.projectId)) continue
      return r
    }
    return { kind: 'home' }
  }
  /** × on a tab, or ⌘W on a console: the tab goes, the session keeps running in the main process (ADR-0031 §2). */
  const closeConsole = (sessionId: string): void => {
    setConsoles((old) => withoutConsole(old, sessionId))
    if (active.kind !== 'console' || active.sessionId !== sessionId) return
    const next = neighbourOf(consoles, sessionId)
    goTo(next ? { kind: 'console', sessionId: next } : placeBeforeConsoles())
  }
  const closeConsoleRef = useRef(closeConsole)
  closeConsoleRef.current = closeConsole
  // A session the main process no longer holds (dismissed, reaped) takes its tab with it.
  useEffect(() => {
    if (sessions === null) return
    const kept = prunedConsoles(consoles, sessions, seenSessions.current)
    for (const s of sessions) seenSessions.current.add(s.sessionId)
    if (kept.length === consoles.length) return
    for (const id of consoles) if (!kept.includes(id)) closeConsoleRef.current(id)
  }, [sessions, consoles])
  useEffect(() => { if (isMainWindow) writeOpenConsoles(consoles) }, [consoles, isMainWindow])
  const consoleTabs = consoles.map((id) => {
    const s = (sessions ?? []).find((x) => x.sessionId === id)
    return { sessionId: id, title: consoleTitleOf(s, projects), runner: s ? runnerLabel(s.optionId, t) : null }
  })
  const consoleSession = active.kind === 'console' ? (sessions ?? []).find((x) => x.sessionId === active.sessionId) : undefined
  // #endregion console-tabs-shell

  // ALL HOOKS ABOVE, every return below (S01). These three used to sit at the
  // top, with `useEffect` and `useRef` beneath them — a React invariant
  // violation on the very transition the app makes at boot, when
  // `sessionWindowId` goes from undefined to null and three more hooks start
  // running than the previous render had.
  //
  // NOT REPRODUCED, and that is stated rather than implied: three attempts to
  // drive the transition in a test stalled on the boot stubs, and the app boots
  // daily. The move is prophylactic, it costs nothing, and it removes a
  // question that a comment could only argue about (R-004: a verification that
  // cannot reach the thing is inconclusive about the harness).
  if (sessionWindowId === undefined)
    return error ? <BootFailure raw={error} onRetry={() => window.location.reload()} /> : <div className="booting" />
  if (fileWindowPath) return <EditorWindow filePath={fileWindowPath} />
  if (sessionWindowId) return <SessionWindow sessionId={sessionWindowId} />

  // Where the rail marks the person and what the top bar says (SCN-162). A start path and a project draft are
  // «Создать»'s; a place reached from another one (the board, the plan, Help…) marks nothing on the rail.
  const railAt: React.ComponentProps<typeof LaunchShell>['at'] = showSettings
    ? { kind: 'settings' }
    : active.kind === 'home' || active.kind === 'agents' || active.kind === 'history' ? { kind: active.kind }
    : active.kind === 'start' || active.kind === 'draft' ? { kind: 'create' }
    : active.kind === 'project' ? { kind: 'project', projectId: active.projectId }
    : active.kind === 'console' && consoleSession ? { kind: 'project', projectId: consoleSession.projectId }
    : { kind: 'elsewhere' }
  const placeTitle = showSettings ? t('rail.settings')
    : active.kind === 'home' ? t('rail.home')
    : active.kind === 'agents' ? t('rail.agents')
    : active.kind === 'history' ? t('acts.title')
    : active.kind === 'start' || active.kind === 'draft' ? t('create.title')
    : active.kind === 'project' || active.kind === 'guide' ? ((projects ?? []).find((p) => p.id === active.projectId)?.name ?? t('app.loading'))
    : active.kind === 'board' ? t('launch.nav.board')
    : active.kind === 'comms' ? t('launch.nav.comms')
    : active.kind === 'graph' ? t('graph.title')
    : active.kind === 'plan' ? t('launch.nav.plan')
    : active.kind === 'help' ? t('launch.nav.help')
    : active.kind === 'where' ? t('launch.nav.where')
    : active.kind === 'persona' ? t('settings.more.persona')
    : active.kind === 'welcome' ? t('launch.brand.product')
    : active.kind === 'console' ? (consoleTitleOf(consoleSession, projects) ?? t('consoles.reading'))
    : t('launch.nav.fabric')

  return (
    <OpenConsoleContext.Provider value={openConsole}>
    <div className="app launch-root">
      {/* 0.3.7 wave 3 (SCN-162): ONE rail with «＋ Создать», the five places and the projects list. No tab strip and no
          Back of Fabric's own (⌘[ and ⌘] above); the places that left the rail are reached from where they belong. */}
      <LaunchShell
        projects={projects}
        projectsProblem={projectsProblem}
        projectsReadAt={projectsReadAt}
        onRetryProjects={() => void refreshProjects()}
        at={railAt}
        // The page starts at its top on a new page of the place (shared/appRoute.ts#scrollKeyOf, SCR-84); App's own
        // placeKey also times «new since» and includes Settings, so the scroll key is its own.
        placeKey={scrollKeyOf(active, workspaceFor)}
        // CO-388: set by ⌘[ / ⌘] before the route changes and cleared by the effect above, which runs after the shell's own
        // (a child's effects run first), so the shell reads it true exactly on the render a travel caused.
        restoreScroll={travelling.current}
        onGraph={(projectId) => setActive(projectId ? { kind: 'graph', projectId } : { kind: 'graph' })}
        title={placeTitle}
        pins={pins}
        lastActivity={lastActivity}
        live={liveProjects}
        waiting={waiting}
        commsUnread={commsUnread}
        machine={machineOf({ read: feed !== null, failed: journalFailed }, error)}
        onPlace={(place: RailPlace) => {
          setShowSettings(place === 'settings')
          if (place === 'settings') return
          setWorkspaceFor(null)
          goTo(place === 'create' ? { kind: 'start', path: 'menu' } : { kind: place })
        }}
        onCreateProject={startProject}
        onProject={(projectId: string) => { setShowSettings(false); openProject(projectId) }}
        onSearch={() => setPanel((p) => togglePanel(p, 'search', { toggle: true }))}
        consoles={<ConsoleTabs tabs={consoleTabs} activeId={active.kind === 'console' ? active.sessionId : null}
          onSelect={(sessionId) => void openConsole(sessionId)} onClose={closeConsole} />}
        actLine={<ActLine act={lineAct} onUndo={(seq) => window.fabric.acts.undo(seq)}
          onUndone={(undone) => { if (undone.record.kind === 'draft.discard') draftsRestored(true) }} />}
      >


      <StackHealthNotice />

      {linkNotice && (
        <Banner
          actions={
            <Button tone="ghost" onClick={() => { setLinkNotice(null); setLinksDropped(0) }}>
              {t('common.dismiss')}
            </Button>
          }
        >
          {t(LINK_NOTICE_KEY[linkNotice])}
          {linksDropped > 0 && ` ${t('links.notice.dropped', { count: linksDropped })}`}
        </Banner>
      )}

      {error && (
        <Banner
          actions={
            <Button tone="ghost" onClick={() => setError(null)}>
              {t('common.dismiss')}
            </Button>
          }
        >
          <OperatorError raw={error} />
        </Banner>
      )}

      <div className={searchOpen || chatOpen || historyOpen || accessOpen ? 'shell shell-with-panel' : 'shell'}>
      {/* Inside the shell, so History and Agent access open BESIDE Settings, not below it (0.3.6 review UX-10). */}
      {showSettings && (
        <SettingsScreen
          settings={settings}
          onOpenHistory={() => setPanel('history')}
          onOpenAccess={() => setPanel('access')}
          onOpen={(to) => { setShowSettings(false); goTo({ kind: to }) }}
          commsUnread={commsUnread}
          onChange={async (next) => {
            // A write the main process could not even answer is said, not left as an unhandled rejection (ER-8).
            const written = await window.fabric.settings.write(next).catch((e: unknown) => {
              setError(t('settings.notSaved', { reason: explainError(e, t) }))
              return null
            })
            if (!written) return
            // The settings the DISK holds, not the ones that were asked for: a
            // refused write used to leave the screen showing the new value
            // while the file still held the old one (S14).
            onSettings(written.settings)
            if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
          }}
        />
      )}
      {/* Settings is a screen (SCR-52): the page under it stays mounted, so returning loses nothing typed. */}
      <main className="content" hidden={showSettings}>
        {active.kind === 'console' && (
          <SessionWindow key={active.sessionId} sessionId={active.sessionId}
            onDetach={() => window.fabric.windows.openSession(active.sessionId)} />
        )}
        {active.kind === 'history' && (
          <HistoryScreen projects={projects} mark={markOf(marks, ['act'])} feed={feed} feedProjects={projects} feedFailed={journalFailed} sessions={sessions} onOpen={openEntity} />
        )}
        {active.kind === 'board' && (
          <BoardScreen
            key={`${active.projectId ?? 'estate'}:${active.item ?? ''}:${active.topic ? 'topic' : ''}:${active.needs ? 'needs' : ''}`}
            mode={active.needs ? 'needs' : undefined}
            projectId={active.projectId ?? null}
            initialItem={active.item ?? null}
            startTopic={active.topic === true}
            projects={projects}
            feedMark={markOf(marks, ['task', 'work', 'question', 'goal', 'proposal', 'grant', 'policy', 'effect'])}
            onOpen={openEntity}
            onError={setError}
            onPulse={() => setActive({ kind: 'pulse', projectId: active.projectId ?? null })}
          />
        )}
        {active.kind === 'graph' && (
          <GraphScreen projectId={active.projectId ?? null} feedMark={markOf(marks, ['project'])}
            onProject={openProject} onWhole={() => setActive({ kind: 'graph' })} />
        )}
        {active.kind === 'comms' && (
          <CommsScreen
            projects={projects}
            onPulse={() => setActive({ kind: 'pulse' })}
            seen={settings.commsReadThrough}
            onRead={(marks) => void onCommsRead(marks)}
            heads={commsHeads}
          />
        )}
        {active.kind === 'help' && (
          <HelpScreen
            projects={projects}
            onChat={(suggestion) => openChat(suggestion ?? null)}
            onGuide={(projectId) => setActive({ kind: 'guide', projectId })}
            onBack={() => setActive({ kind: 'home' })}
            onGo={goFromHelp}
          />
        )}
        {active.kind === 'welcome' && (
          <FirstRun
            locale={settings.locale}
            onLocale={async (locale) => {
              // P-24: written at once, so the rest of the first run (and every agent's next rules) read in it.
              try {
                const written = await window.fabric.settings.write({ locale })
                onSettings(written.settings)
                if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
              } catch (e) {
                setError(t('settings.notSaved', { reason: errorText(e) }))
              }
            }}
            onFinish={async (next) => {
              // Finishing or skipping is the same act: the first run is not shown again, and Help reopens it.
              // A write that fails — refused or thrown — is said, and the operator still goes where they chose.
              try {
                const written = await window.fabric.settings.write({ firstRun: { completedAt: new Date().toISOString() } })
                onSettings(written.settings)
                if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
              } catch (e) {
                setError(t('settings.notSaved', { reason: errorText(e) }))
              }
              if (next === 'new') newDraft()
              else goTo(next === 'home' ? { kind: 'home' } : { kind: 'start', path: next })
              activeKind.current = next === 'new' ? 'draft' : next === 'home' ? 'home' : 'start'
              releaseHeld(next === 'home' ? 'first-run-home' : 'first-run-chose')
            }}
          />
        )}
        {active.kind === 'start' && (
          <StartScreen
            path={active.path}
            projects={projects}
            onPath={(path) => (path === 'new' ? newDraft() : goTo({ kind: 'start', path }))}
            onCreated={async (projectId) => { await refreshProjects(); openProject(projectId) }}
            onOpenProject={(projectId, section) => {
              openProject(projectId)
              setProjectSection(section ?? 'overview')
              const anchor = section ? PROJECT_SECTION_ANCHOR[section] : null
              if (anchor) revealSection(anchor)
            }}
            onSetUp={async (projectId) => {
              // Plan R3a: the project opens with the setup instruction in its task field and the field in view; the
              // operator chooses the agent and presses Run — nothing starts on its own.
              const text = t('tasks.presetSetupText')
              setTaskDrafts((old) => ({ ...old, [projectId]: { instruction: text, preset: 'setup', presetText: text } }))
              await refreshProjects()
              openProject(projectId)
              setProjectSection('overview')
              revealSection('sec-tasks')
            }}
            onHome={() => goTo({ kind: 'home' })}
            onProjectsChanged={() => void refreshProjects()}
            drafts={tabs.filter((x): x is Extract<Tab, { kind: 'draft' }> => x.kind === 'draft' && !!drafts[x.id]).map((x) => ({ id: x.id, name: drafts[x.id].name }))}
            onDraft={(id) => setActive({ kind: 'draft', id })}
          />
        )}
        {active.kind === 'guide' && (projects ?? []).some((p) => p.id === active.projectId) && (
          <GuideScreen
            key={active.projectId}
            project={(projects ?? []).find((p) => p.id === active.projectId)!}
            onChat={() => openChat(null)}
            onProject={() => openProject(active.projectId)}
            onDone={() => setActive({ kind: 'home' })}
          />
        )}
        {active.kind === 'persona' && (
          <PersonaScreen onDone={() => setActive({ kind: 'home' })} />
        )}
        {active.kind === 'pulse' && (
          <PulseScreen
            key={active.projectId ?? 'estate'}
            projects={projects}
            feed={feed}
            sessions={sessions}
            projectId={active.projectId ?? null}
            onBoard={() => setActive({ kind: 'board', projectId: active.projectId ?? null })}
            onProject={openProject}
            onReleases={(release) => setActive({ kind: 'releases', projectId: release?.projectId ?? active.projectId ?? null, release: release?.id ?? null })}
          />
        )}
        {active.kind === 'releases' && (
          <ReleasesScreen
            key={`${active.projectId ?? 'all'}:${active.release ?? ''}`}
            projects={projects}
            feed={feed}
            projectId={active.projectId ?? null}
            releaseId={active.release ?? null}
            onPulse={() => setActive({ kind: 'pulse', projectId: active.projectId ?? null })}
            onBoard={(projectId) => setActive({ kind: 'board', projectId })}
          />
        )}
        {active.kind === 'plan' && (
          <PlanScreen
            projects={projects}
            feed={feed}
            feedMark={markOf(marks, ['task', 'goal'])}
            level={active.projectId ? { at: 'project', projectId: active.projectId } : { at: 'portfolio' }}
            onProject={openProject}
            onTask={(projectId, taskId) => openEntity(projectId, { kind: 'task', id: taskId })}
            onPulse={(projectId) => setActive({ kind: 'pulse', projectId })}
          />
        )}
        {active.kind === 'where' && (
          <WhereWorkScreen
            feedMark={markOf(marks, ['work', 'task', 'agent'])}
            onProject={openProject}
            onTask={(projectId, taskId) => openEntity(projectId, { kind: 'task', id: taskId })}
            onReview={(projectId) => { openProject(projectId); revealSection('sec-board') }}
            onError={setError}
          />
        )}
        {active.kind === 'agents' && (
          <>
          {/* SCN-167: the coding agents that joined on their own, with «Отключить» and «Пустить снова», above the list. */}
          {/* OF-30 (the operator's walk, 2026-10-22): every agent at work, a terminal's included, by the task it holds. */}
          <AgentsAtWork mark={markOf(marks, ['work', 'task', 'agent', 'session'])} onOpen={openProject} />
          <JoinedAgents projects={projects} mark={markOf(marks, ['act', 'access'])} />
          <EstateAgents
            // NULL TRAVELS (M108, UXA-C05). Five lines below, `EstateHome` is
            // handed both of these unchanged and says why in its own props;
            // collapsing them here let the agents view state "no agent is
            // running anywhere in this estate" as a MEASUREMENT, on the first
            // paint, before anything had been read.
            sessions={sessions}
            projects={projects}
            onOpen={openEntity}
            onError={setError}
          />
          </>
        )}
        {active.kind === 'home' && (
          <EstateHome
            onOpenEntity={openEntity}
            projects={projects}
            sessions={sessions}
            feed={feed}
            marks={marks}
            // HOW FAR THIS OPERATOR HAS READ (AX-07). It travels from settings
            // rather than being counted here, because it is a fact about a
            // person on a machine and the feed is a fact about the estate.
            readThroughSeq={settings.readThroughSeq}
            onRead={async (throughSeq) => {
              // The cursor moves only from an act: this handler exists on a
              // button, and nothing in the arrival path can reach it. That is
              // the invariant `inbox.ts` states and could not enforce while it
              // had no callers at all.
              // The read position ONLY (audit A7-008): this screen's copy of the settings was read at start, and
              // sending it back reverted the tabs main had saved since and could empty the workspace folder.
              const written = await window.fabric.settings.write({ readThroughSeq: throughSeq }).catch((e: unknown) => {
                setError(t('settings.notSaved', { reason: explainError(e, t) }))
                return null
              })
              if (!written) return
              onSettings(written.settings)
              if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
            }}
            onOpen={openProject}
            onNew={() => goTo({ kind: 'start', path: 'menu' })}
            onBoard={() => setActive({ kind: 'board' })}
            onNeeds={(item) => setActive({ kind: 'board', needs: true, item: item ?? null })}
            onAddTopic={() => setActive({ kind: 'board', topic: true })}
            onPulse={() => setActive({ kind: 'pulse' })}
            onPersona={() => setActive({ kind: 'persona' })}
            onComms={() => goTo({ kind: 'comms' })}
            onAgents={() => setActive({ kind: 'agents' })}
          />
        )}
        {active.kind === 'draft' && (
          <Onboarding
            draft={drafts[active.id] ?? EMPTY_DRAFT}
            onDraftChange={(next) =>
              setDrafts((old) => ({ ...old, [(active as { id: string }).id]: next }))
            }
            onCreated={(p) => replaceDraft(active.id, p)}
            onCancel={() => closeTab(active)}
            onError={setError}
          />
        )}
        {active.kind === 'project' && current && workspaceFor !== current.id && (
          <ProjectHome
            // UX-01. Without a key React REUSES this instance across projects,
            // so every loader still in flight for the old one lands in the new
            // one's view — stats, repositories, tasks, the board. Remounting is
            // the whole class rather than a guard per loader, and a guard per
            // loader is a list the next loader will not be added to.
            key={current.id}
            project={current}
            sessions={sessions === null ? null : sessions.filter((s) => s.projectId === current.id)}
            feed={feed === null ? null : feed.filter((e) => e.project_id === current.id)}
            marks={marks}
            onChanged={refreshProjects}
            onSessionsChanged={refreshSessions}
            onOpenWorkspace={() => setWorkspaceFor(current.id)}
            // Addressed to THIS project, and only a task is focusable by a
            // screen that exists: the resolver already refused everything else,
            // and `taskOf` refuses again rather than trusting it.
            requestedTask={taskOf(focusFor(focus, current.id) ?? { kind: 'work', id: '' })}
            taskDraft={taskDrafts[current.id] ?? null}
            onTaskDraftChange={(patch) =>
              // Functional, and merged onto whatever is there NOW: three
              // setters in one handler must compose rather than race.
              setTaskDrafts((old) => ({
                ...old,
                [current.id]: mergeDraft(old[current.id], patch)
              }))
            }
            // Served — the LATCH closes, and the address stays put. Clearing
            // the address here is what used to leave the route unable to say
            // where the operator was.
            onTaskOpened={() => setHonoured(addressKey(active))}
            onOpenEntity={openEntity}
            onPlan={(projectId) => setActive({ kind: 'plan', projectId })}
            onPulse={(projectId) => setActive({ kind: 'pulse', projectId })}
            onBoard={(projectId, item) => setActive({ kind: 'board', projectId, item: item ?? null })}
            onError={setError}
          />
        )}
        {active.kind === 'project' && current && workspaceFor === current.id && (
          <Workspace
            project={current}
            sessions={sessions === null ? null : sessions.filter((s) => s.projectId === current.id)}
            feed={feed === null ? null : feed.filter((e) => e.project_id === current.id)}
            onBack={() => setWorkspaceFor(null)}
          />
        )}
      </main>

        {searchOpen && (
          <SearchPanel
            onClose={() => setPanel((p) => closePanel(p, 'search'))}
            onOpen={(projectId, ref) => {
              openEntity(projectId, ref)
              setPanel((p) => closePanel(p, 'search'))
            }}
            onError={setError}
          />
        )}
        {chatOpen && <CeoChat key={chatSuggestion ?? 'chat'} suggestion={chatSuggestion} onClose={() => setPanel((p) => closePanel(p, 'chat'))} projects={projects} />}
        {historyOpen && <PrivateHistoryPanel onClose={() => setPanel((p) => closePanel(p, 'history'))} />}
        {accessOpen && <AgentAccessPanel onClose={() => setPanel((p) => closePanel(p, 'access'))} />}
      </div>
      </LaunchShell>
    </div>
    </OpenConsoleContext.Provider>
  )
}

/** The route as a tab, where it is one. The agents view and the board are not. */
function tabOf(route: AppRoute): Tab | null {
  return route.kind === 'agents' || route.kind === 'history' || route.kind === 'where' || route.kind === 'board' || route.kind === 'comms' || route.kind === 'graph' || route.kind === 'plan' || route.kind === 'pulse' || route.kind === 'releases' || route.kind === 'persona' || route.kind === 'help' || route.kind === 'guide' || route.kind === 'welcome' || route.kind === 'start' || route.kind === 'console' ? null : route
}

function keyOf(tab: Tab): string {
  return tab.kind === 'home' ? 'home' : tab.kind === 'draft' ? tab.id : tab.projectId
}
