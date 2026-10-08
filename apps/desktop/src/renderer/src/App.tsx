import { useCallback, useEffect, useRef, useState } from 'react'
import { NO_MARKS, advance, type FeedMarks } from '../../shared/feedMarks.ts'
import { APP_SETTINGS_DEFAULTS } from '../../shared/types'
import type { AppSettings, FeedEvent, ProjectRow, Quota, TerminalSession } from '../../shared/types'
import { restoreTabs, toPersist } from '../../shared/tabs.ts'
import {
  addressKey,
  focusFor,
  focusSurvives,
  returnableTo,
  revealAt,
  routeToEntity,
  routeToProject,
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
import { PersonaProvider } from './launch/persona'
import { PlanScreen } from './launch/PlanScreen'
import { PulseScreen } from './launch/PulseScreen'
import { ReleasesScreen } from './launch/ReleasesScreen'
import { PersonaScreen } from './launch/PersonaScreen'
import { GuideScreen, HelpScreen } from './launch/HelpScreens'
import { QuotaPanel } from './launch/QuotaPanel'
import { markOf } from '../../shared/feedMarks.ts'
import { CeoChat } from './CeoChat'
import { PrivateHistoryPanel } from './PrivateHistoryPanel'
import { AgentAccessPanel } from './AgentAccessPanel'
import { UsageCountsSetting } from './UsageCountsSetting'
import { UsageCountsNotice } from './UsageCountsNotice'
import { FallbackOrderSetting } from './FallbackOrderSetting'
import { BoardPanel } from './BoardPanel'
import { SearchPanel } from './SearchPanel'
import { EstateAgents } from './EstateAgents'
import { Banner, Button, Field, TabStrip, Toolbar } from './components'
import { I18nProvider, useT, type Locale } from './i18n'
import { LaunchShell, PROJECT_SECTION_ANCHOR, revealSection, type ProjectSection, launchDiscuss } from './launch/LaunchShell'
import './launch/launch.css'
import { Onboarding } from './Onboarding'
import { FirstRun, firstRunDue } from './start/FirstRun'
import { StartScreen, errorText } from './start/StartPaths'
import './start/start.css'
import { BootFailure, OperatorError } from './OperatorError'
import { ProjectHome } from './ProjectHome'
import { SessionWindow } from './SessionWindow'
import { Workspace } from './Workspace'

const FEED_POLL_MS = 2000 // ADR-0027: the table is the record; polling replay is the v1 wake-up
const SESSION_POLL_MS = 3000
const QUOTA_POLL_MS = 60_000

/** An onboarding draft. It lives in the shell rather than in the form, so
 *  switching tabs and coming back finds the work still there — a draft is lost
 *  only when the operator closes its tab, and then only after confirming. */
// ONE DECLARATION (R-005, AX-05). `Draft` and `EMPTY_DRAFT` moved to
// `shared/onboardingDraft.ts` when the draft became durable: the main process
// validates the file on its way to disk and cannot import a renderer module, so
// a shape both processes need lives in `shared`. Re-exported here because this
// is where every consumer already imports it from.
import { EMPTY_DRAFT, mayPersist, type Draft } from '../../shared/onboardingDraft.ts'
import type { QuotaReading } from '../../shared/quotaReading.ts'

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
  const [estateName, setEstateName] = useState('')
  /** NULL until the list has been read (M108). `[]` is an answer — "this estate
   *  holds no projects" — and it was the value every launch started with, so the
   *  first screen told the operator a fact nobody had measured. */
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
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
  /** M83 via M113 — the account's windows, which are an ESTATE fact. Null when
   *  there is nothing to say: not signed in is an answer, not an error. */
  /**
   * THREE STATES, not two (AX-14). `null` used to mean both "the reader had
   * nothing to say" and "nobody has looked yet" — and the estate panel rendered
   * the first sentence for both, diagnosing the operator's machine on its very
   * first paint. A failed read joined them through the catch below.
   */
  const [quota, setQuota] = useState<QuotaReading>({ read: false })
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  /** Search, the conversation with Fabric (SCR-64), private history (SCR-65) and Agent access (SCR-76):
   *  ONE side panel at a time, held in one state (UX-13). */
  const [panel, setPanel] = useState<SidePanel>(null)
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
  /**
   * Where the operator came from, kept SEPARATELY from the focus (AX-05).
   *
   * A focus is consumed — the screen that honours it clears it, or it fires
   * again on the next mount — so `focus.returnTo` was gone by the time anyone
   * could have offered a Back. It was written on every navigation and read by
   * nothing, for as long as it has existed.
   */
  const [cameFrom, setCameFrom] = useState<AppRoute | null>(null)
  /** The instruction being typed, per project. It has to live ABOVE the remount
   *  above, or switching tabs would throw it away — and it has to be per
   *  project, or it would follow the operator into the wrong one and be run
   *  there. Both halves are UX-01. */
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
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
  }, [readInitialDrafts])

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
    const loaded = await window.fabric.projects.list()
    setProjects(loaded)
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
        if (events.length === 0) { setFeed((old) => old ?? []); return }
        lastSeq.current = events[events.length - 1].seq
        setMarks((prev) => advance(prev, events))
        setFeed((old) => [...(old ?? []), ...events].slice(-500))
        if (events.some((e) => e.type.startsWith('project.'))) void refreshProjects()
        if (events.some((e) => e.type.startsWith('terminal.'))) void refreshSessions()
      } catch (e) {
        // The same failure every two seconds would make the banner impossible to
        // dismiss; raise it once and keep quiet until something changes.
        const message = String(e)
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

  useEffect(() => {
    if (sessionWindowId !== null || fileWindowPath) return
    void refreshProjects()
    void refreshSessions()
    // Never fails the screen: a quota we cannot read is a missing panel, not an
    // error — the same rule the project page already follows.
    const readQuota = (): void => {
      void window.fabric.quota
        .read()
        .then((q) => setQuota({ read: true, quota: q }))
        // NOT null. "We could not ask" is a fact about this app, and reporting
        // it as the account's state is a diagnosis nobody made.
        .catch((e: unknown) => setQuota({ read: true, failed: String(e) }))
    }
    readQuota()
    const h = setInterval(() => void refreshSessions(), SESSION_POLL_MS)
    // The quota is a two-minute reading (the reader's TTL); asking every 3 s only re-served
    // the cache at best and, before every outcome was held, re-read the Keychain at worst.
    const q = setInterval(readQuota, QUOTA_POLL_MS)
    return () => { clearInterval(h); clearInterval(q) }
  }, [sessionWindowId, refreshProjects, refreshSessions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowSettings(false)
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

  // ADR-0100: the first run is shown ONCE, to an estate with no project, and only after both the
  // settings and the project list are known — an unknown list is not an empty one.
  const firstRunOffered = useRef(false)
  useEffect(() => {
    if (firstRunOffered.current || projects === null) return
    firstRunOffered.current = true
    if (firstRunDue(settings.firstRun?.completedAt, projects)) goTo({ kind: 'welcome' })
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
    const origin = active
    openProject(projectId)
    goTo(addressed.addressed ? addressed.route : addressed.fallback)
    // The origin outlives the arrival, because the operator needs the way back
    // AFTER they have got there.
    setCameFrom(origin)
  }
  /**
   * A deliberate move clears the way back.
   *
   * `appRoute.ts`'s header calls the alternative a haunting: a request that
   * fires later, from somewhere else entirely. A Back that survives the
   * operator opening three other tabs points at a place they have forgotten
   * choosing.
   */
  const clearOrigin = (): void => setCameFrom(null)

  const newDraft = (): void => {
    draftStarted.current = true
    const id = `draft-${crypto.randomUUID()}`
    setDrafts((old) => ({ ...old, [id]: { ...EMPTY_DRAFT, projectId: crypto.randomUUID() } }))
    setTabs((old) => [...old, { kind: 'draft', id }])
    setActive({ kind: 'draft', id })
    setWorkspaceFor(null)
  }
  const closeTab = (tab: Tab): void => {
    // A filled-in draft is real work; dropping it is a decision, not a side effect.
    if (tab.kind === 'draft') {
      const d = drafts[tab.id]
      if (d && draftIsDirty(d) && !window.confirm(t('onboarding.discardConfirm'))) return
      setDrafts((old) => {
        const next = { ...old }
        delete next[tab.id]
        return next
      })
    }
    setTabs((old) => old.filter((x) => keyOf(x) !== keyOf(tab)))
    if (tabOf(active) && keyOf(tabOf(active)!) === keyOf(tab)) setActive({ kind: 'home' })
  }
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
    const tab = tabOf(active)
    if (tab && tab.kind !== 'home') closeTab(tab)
  }
  useEffect(() => window.fabric.tabs.onCloseActive(() => closeTabRef.current()), [])

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

  return (
    <div className="app launch-root">

      {/* THE WAY BACK, and the field that records it had no reader until now
          (AX-05). Shown only when it goes somewhere else: a Back to where you
          already are is a control that does nothing, which `returnableTo`
          decides rather than this line. */}
      {returnableTo(cameFrom, active) && (
        <Toolbar>
          <Button
            tone="ghost"
            onClick={() => {
              const to = returnableTo(cameFrom, active)
              if (!to) return
              goTo(to)
              clearOrigin()
            }}
          >
            {t('nav.back')}
          </Button>
        </Toolbar>
      )}      <TabStrip
        activeKey={tabOf(active) && active.kind !== 'home' ? keyOf(tabOf(active)!) : null}
        home={{
          // The launch design names the home tab by the product (SCR-30); the name
          // is visible, so it is also the accessible name.
          label: t('launch.nav.fabric'),
          glyph: t('launch.nav.fabric'),
          onSelect: () => {
            setActive({ kind: 'home' })
            setWorkspaceFor(null)
          }
        }}
        close={{ label: t('tab.close'), glyph: t('glyph.close') }}
        items={tabs.map((tab) => ({
          key: keyOf(tab),
          label:
            tab.kind === 'project'
              ? ((projects ?? []).find((p) => p.id === tab.projectId)?.name ?? t('app.loading'))
              : (tab.kind === 'draft' ? drafts[tab.id]?.name.trim() : '') || t('tab.new'),
          badge:
            tab.kind === 'project' &&
            (sessions ?? []).filter((s) => s.projectId === tab.projectId && s.running).length > 0
              ? t('tab.live', {
                  count: (sessions ?? []).filter((s) => s.projectId === tab.projectId && s.running)
                    .length
                })
              : undefined,
          onSelect: () => {
            setActive(tab)
            setWorkspaceFor(null)
          },
          onClose: () => closeTab(tab)
        }))}
        actions={[]}
        // The seed's technical name for the default estate (`supabase/seed.sql`) reads as a question on a fresh
        // install; it is shown as the same words the breadcrumb uses. A name the operator gave is shown as given.
        trailing={estateName === SEED_ESTATE_NAME ? t('launch.workspace') : estateName}
      />

      <LaunchShell
        estateName={estateName}
        projects={projects}
        at={showSettings ? { kind: 'settings' } : active.kind === 'board' ? { kind: 'board' } : active.kind === 'plan' ? { kind: 'plan' } : active.kind === 'pulse' || active.kind === 'releases' ? { kind: 'pulse' } : active.kind === 'help' || active.kind === 'guide' ? { kind: 'help' } : active.kind === 'quota' ? { kind: 'quota' } : active.kind === 'project' ? { kind: 'project', projectId: active.projectId, section: projectSection } : active.kind === 'agents' ? { kind: 'agents' } : active.kind === 'draft' ? { kind: 'draft' } : active.kind === 'start' ? { kind: 'start' } : active.kind === 'welcome' ? { kind: 'welcome' } : { kind: 'home' }}
        onHome={() => { setShowSettings(false); setActive({ kind: 'home' }); setWorkspaceFor(null) }}
        onBoard={() => { setShowSettings(false); setActive({ kind: 'board' }) }}
        onPlan={() => { setShowSettings(false); setActive({ kind: 'plan' }) }}
        onNewProject={() => { setShowSettings(false); goTo({ kind: 'start', path: 'menu' }) }}
        onProject={(projectId: string, section: ProjectSection) => {
          setShowSettings(false)
          openProject(projectId)
          setProjectSection(section)
          const anchor = PROJECT_SECTION_ANCHOR[section]
          // After the project has rendered: the anchor is its section, not a route.
          if (anchor) revealSection(anchor)
        }}
        onAgents={() => { setShowSettings(false); setActive({ kind: 'agents' }) }}
        onSettings={() => setShowSettings((v) => !v)}
        onHistory={() => setPanel('history')}
        onSearch={() => setPanel((p) => togglePanel(p, 'search', { toggle: true }))}
        searchOpen={searchOpen}
        onProfile={() => { setShowSettings(false); setActive({ kind: 'persona' }) }}
        profileOpen={!showSettings && active.kind === 'persona'}
        // Hidden where the screen is already that conversation's start (Home, the start paths, Help) and on the
        // guide, whose card carries its own Discuss beside the project it is about (docs/ux/screens.md#launch-chrome).
        onDiscuss={launchDiscuss(showSettings ? 'settings' : active.kind) ? () => openChat(null) : null}
        onChat={() => { setChatSuggestion(null); setPanel((p) => togglePanel(p, 'chat', { toggle: true })) }}
        onHelp={() => { setShowSettings(false); setActive({ kind: 'help' }) }}
        onQuota={() => { setShowSettings(false); setActive({ kind: 'quota' }) }}
        chatOpen={chatOpen}
      >
      {showSettings && (
        <SettingsBar
          settings={settings}
          onOpenHistory={() => setPanel('history')}
          onOpenAccess={() => setPanel('access')}
          onChange={async (next) => {
            const written = await window.fabric.settings.write(next)
            // The settings the DISK holds, not the ones that were asked for: a
            // refused write used to leave the screen showing the new value
            // while the file still held the old one (S14).
            onSettings(written.settings)
            if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
          }}
        />
      )}

      {/* A7-012: no usage count leaves until this is answered (or the switch in Settings is). */}
      <UsageCountsNotice />

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
      <main className="content">
        {active.kind === 'board' && (
          <BoardScreen
            key={`${active.projectId ?? 'estate'}:${active.item ?? ''}:${active.topic ? 'topic' : ''}`}
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
        {active.kind === 'quota' && (
          <div className="lp" data-launch-view="quotas">
            <header className="lp-heading">
              <div>
                <p className="lp-kicker">{t('launch.nav.manage')}</p>
                <h2 tabIndex={-1}>{t('launch.nav.quota')}</h2>
                <p>{t('launch.quota.lede')}</p>
              </div>
            </header>
            <QuotaPanel quota={quota} />
          </div>
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
        {active.kind === 'agents' && (
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
              const written = await window.fabric.settings.write({ ...settings, readThroughSeq: throughSeq })
              onSettings(written.settings)
              if (!written.saved) setError(t('settings.notSaved', { reason: written.reason ?? '' }))
            }}
            onOpen={openProject}
            onNew={() => goTo({ kind: 'start', path: 'menu' })}
            onBoard={() => setActive({ kind: 'board' })}
            onAddTopic={() => setActive({ kind: 'board', topic: true })}
            onPulse={() => setActive({ kind: 'pulse' })}
            onPersona={() => setActive({ kind: 'persona' })}
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
  )
}

function SettingsBar({
  settings,
  onChange,
  onOpenHistory,
  onOpenAccess
}: {
  settings: AppSettings
  onOpenHistory: () => void
  onOpenAccess: () => void
  onChange: (next: Partial<AppSettings>) => Promise<void> | void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="settings-bar">
      <Button tone="ghost" onClick={onOpenHistory}>{t('settings.history')}</Button>
      <Button tone="ghost" onClick={onOpenAccess}>{t('settings.agentAccess')}</Button>
      <Field label={t('settings.theme')}>
        {(id) => (
          <select
            id={id}
            value={settings.theme}
            onChange={(e) => void onChange({ theme: e.target.value as AppSettings['theme'] })}
          >
            <option value="dark">{t('settings.themeDark')}</option>
            <option value="light">{t('settings.themeLight')}</option>
            <option value="system">{t('settings.themeSystem')}</option>
          </select>
        )}
      </Field>
      <Field label={t('settings.language')}>
        {(id) => (
          <select
            id={id}
            value={settings.locale}
            onChange={(e) => void onChange({ locale: e.target.value as AppSettings['locale'] })}
          >
            <option value="en">{t('settings.localeEn')}</option>
            <option value="ru">{t('settings.localeRuUntranslated')}</option>
          </select>
        )}
      </Field>
      <Field label={t('power.label')}>
        {(id) => (
          <select
            id={id}
            value={settings.keepAwake}
            onChange={(e) =>
              void onChange({ keepAwake: e.target.value as AppSettings['keepAwake'] })
            }
          >
            <option value="always">{t('power.always')}</option>
            <option value="while-working">{t('power.while-working')}</option>
            <option value="never">{t('power.never')}</option>
          </select>
        )}
      </Field>
      {/* Said here rather than discovered: the blocker stops the MACHINE
          suspending and lets the screen sleep, and macOS ignores it with the
          lid closed on battery. A setting that promises what the OS will not
          do is worse than no setting. */}
      <span className="settings-note">{t('power.note')}</span>
      <UsageCountsSetting />
      <FallbackOrderSetting value={settings.runnerFallback} onChange={onChange} />
    </div>
  )
}

/** The route as a tab, where it is one. The agents view and the board are not. */
function tabOf(route: AppRoute): Tab | null {
  return route.kind === 'agents' || route.kind === 'board' || route.kind === 'plan' || route.kind === 'pulse' || route.kind === 'releases' || route.kind === 'persona' || route.kind === 'help' || route.kind === 'guide' || route.kind === 'quota' || route.kind === 'welcome' || route.kind === 'start' ? null : route
}

function keyOf(tab: Tab): string {
  return tab.kind === 'home' ? 'home' : tab.kind === 'draft' ? tab.id : tab.projectId
}
