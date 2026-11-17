// The screens stand: one real screen of the renderer, in the launch shell's real markup and stylesheets, fed by
// fixtures.ts through a fake `window.fabric`. Opened as index.html#screen=agent&locale=ru&theme=light.
import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@xterm/xterm/css/xterm.css'
import '../src/renderer/src/tokens.paperclip.css'
import '../src/renderer/src/tokens.passioncode.css'
import '../src/renderer/src/tokens.app.css'
import '../src/renderer/src/styles.css'
import '../src/renderer/src/components.css'
import '../src/renderer/src/launch/launch.css'
import '../src/renderer/src/launch/rail.css'
import '../src/renderer/src/start/start.css'
import { fakeApi } from './fakeApi'
import { APP_SETTINGS_DEFAULTS } from '../src/shared/types'
import { NOW, agent, consoleSessions, feed, fixtures, homeReading, project, projects, tasks } from './fixtures'

const params = new URLSearchParams(location.hash.slice(1))
const screen = params.get('screen') ?? 'agent'
const locale = (params.get('locale') ?? 'ru') as 'ru' | 'en'
document.documentElement.dataset.theme = params.get('theme') ?? 'dark'
document.documentElement.lang = locale

// A fixed clock, so «2 ч назад» reads the same on every run.
const RealDate = Date
class StandDate extends RealDate {
  constructor(...a: unknown[]) { super(...((a.length ? a : [NOW]) as [number])) }
  static now(): number { return NOW }
}
;(globalThis as unknown as { Date: DateConstructor }).Date = StandDate as unknown as DateConstructor
;(window as unknown as { fabric: unknown }).fabric = fakeApi(fixtures)

const noop = (): void => {}
const asyncNoop = async (): Promise<void> => {}

async function main(): Promise<void> {
  const { I18nProvider } = await import('../src/renderer/src/i18n')
  let node: React.ReactNode
  let consoleTitle: string | null = null
  let consoleTabs: React.ReactNode = null
  if (screen === 'console' || screen === 'console-ended') {
    // The console under its tab (the operator, 2026-11-17): the top bar as the shell draws it (its title and the console
    // tabs, here two sessions of one project and one coding agent), the console full size under it.
    const { SessionWindow } = await import('../src/renderer/src/SessionWindow')
    const { ConsoleTabs } = await import('../src/renderer/src/launch/ConsoleTabs')
    const { startClocks } = await import('../src/renderer/src/consoles')
    const { en } = await import('../src/renderer/src/i18n/en')
    const { ru } = await import('../src/renderer/src/i18n/ru')
    const words = locale === 'en' ? en : ru
    const clocks = startClocks(consoleSessions.map((s) => ({ sessionId: s.sessionId, title: 'Atlas', runner: 'Claude Code', startedAt: s.startedAt })),
      (iso, seconds) => new Date(iso).toLocaleTimeString(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) }))
    const shown = consoleSessions[1].sessionId
    const title = words['consoles.sessionTitleAt'].replace('{project}', 'Atlas').replace('{runner}', 'Claude Code').replace('{at}', clocks.get(shown) ?? '')
    consoleTitle = title
    consoleTabs = <ConsoleTabs tabs={consoleSessions.map((s) => ({ sessionId: s.sessionId, title: 'Atlas', runner: 'Claude Code', at: clocks.get(s.sessionId) ?? null }))}
      activeId={shown} onSelect={noop} onClose={noop} />
    node = <SessionWindow sessionId={shown} onDetach={asyncNoop} />
  } else if (screen === 'agent') {
    const { AgentsScreen } = await import('../src/renderer/src/launch/AgentsScreen')
    node = <AgentsScreen mark={0} hubMark={0} sessions={[{ id: agent.sessionId, projectId: 'p1', optionId: 'claude-code', title: 'Claude Code', cwd: agent.folder, startedAt: agent.startedAt, status: 'running', permissionMode: 'default' }] as never}
      projects={projects as never} onOpenProject={noop} onOpenTask={noop} onOpenGoal={noop} onCreate={noop} initialSession={agent.sessionId} onPick={noop} onHome={noop} />
  } else if (screen === 'task') {
    const { TaskPage } = await import('../src/renderer/src/TaskPage')
    node = <TaskPage project={project as never} taskId="t1" onBack={noop} onChanged={asyncNoop} onError={noop} onOpenTask={noop} />
  } else if (screen === 'project') {
    const { ProjectLaunch } = await import('../src/renderer/src/launch/ProjectLaunch')
    node = <ProjectLaunch project={project as never} tasks={tasks as never} sessions={[]} feedMark={0} lastEventAt={new Date(NOW).toISOString()}
      onBoard={noop} onReview={noop} onPlan={noop} onOpenTask={noop} onNewTask={noop} onSection={noop} />
  } else if (screen === 'board' || screen === 'review') {
    const { BoardScreen } = await import('../src/renderer/src/launch/BoardScreen')
    node = <BoardScreen feedMark={0} projects={projects as never} mode={screen === 'review' ? 'needs' : 'kanban'} onOpen={noop} onError={noop} />
  } else if (screen === 'comms') {
    const { CommsScreen } = await import('../src/renderer/src/launch/CommsScreen')
    node = <CommsScreen projects={projects as never} mode="threads" seen={{ th2: 12 }} onRead={noop} thread={params.get("thread")} />
  } else if (screen === 'pulse') {
    const { PulseScreen } = await import('../src/renderer/src/launch/PulseScreen')
    node = <PulseScreen projects={projects as never} feed={feed as never} sessions={[]} onBoard={noop} onProject={noop} onReleases={noop} />
  } else if (screen === 'history') {
    const { HistoryScreen } = await import('../src/renderer/src/launch/HistoryScreen')
    node = <HistoryScreen projects={projects as never} mark={0} feed={feed as never} feedProjects={projects as never} onOpen={noop} readThroughSeq={0} onRead={noop} />
  } else if (screen === 'plan') {
    const { PlanScreen } = await import('../src/renderer/src/launch/PlanScreen')
    node = <PlanScreen projects={projects as never} feed={feed as never} feedMark={0} level={{ at: 'project', projectId: 'p1' }} onProject={noop} onTask={noop} onPulse={noop} />
  } else if (screen === 'home') {
    const { EstateHome } = await import('../src/renderer/src/EstateHome')
    node = <EstateHome reading={homeReading as never} projects={projects as never} sessions={[]} feed={feed as never} marks={{ all: 0, byFamily: {} }}
      waitingForYou={{ total: 5, byProject: { p1: 5 } }} toReview={2 as never} onOpen={noop} onNew={noop} onBoard={noop} onNeeds={noop} onAgent={noop} onReview={noop} />
  } else if (screen === 'graph') {
    const { GraphScreen } = await import('../src/renderer/src/launch/GraphScreen')
    node = <GraphScreen projectId="p1" feedMark={0} onProject={noop} onWhole={noop} />
  } else if (screen === 'launch') {
    const { Tasks } = await import('../src/renderer/src/Tasks')
    node = <Tasks project={project as never} feedMark={0} onStarted={noop} onError={noop} />
  } else if (screen === 'access') {
    const { AgentAccessPanel } = await import('../src/renderer/src/AgentAccessPanel')
    node = <AgentAccessPanel page onClose={noop} />
  } else if (screen === 'settings') {
    const { SettingsScreen } = await import('../src/renderer/src/launch/SettingsScreen')
    node = <SettingsScreen settings={{ ...APP_SETTINGS_DEFAULTS, locale, machineTrust: 'mine' } as never} onChange={async () => null} onOpenHistory={noop} onOpen={noop} />
  } else {
    node = <p>unknown screen {screen}</p>
  }
  // Wave U (2026-11-16): the app's real shell around the screen, its rail with places and projects (folding to signs
  // under 900 px as the app's does), so a screen is measured at the width it really gets beside the rail.
  const { LaunchShell } = await import('../src/renderer/src/launch/LaunchShell')
  const at = screen === 'project' || screen === 'task' || screen === 'plan' || screen === 'graph' || screen === 'launch'
    ? { kind: 'project' as const, projectId: 'p1' }
    : screen === 'agent' ? { kind: 'agents' as const, session: agent.sessionId }
      : screen === 'review' ? { kind: 'board' as const }
        : screen === 'pulse' ? { kind: 'elsewhere' as const }
          : { kind: screen as 'home' | 'board' | 'comms' | 'access' | 'history' | 'settings' }
  createRoot(document.getElementById('root')!).render(
    <I18nProvider locale={locale}>
      <div className="app launch-root">
        <LaunchShell projects={projects as never} projectsProblem={null} projectsReadAt={new Date(NOW).toISOString()} onRetryProjects={noop}
          at={at} title={consoleTitle ?? (at.kind === 'project' ? 'Atlas' : '')} pins={['p1']} agents={{ rows: [], problem: null }} onAgent={noop} live={new Set(['p1'])}
          waiting={{ total: 5, byProject: { p1: 5 } }} machine="ok" onPlace={noop} onCreateProject={noop} onProject={noop} onSearch={noop}
          commsUnread={{ count: 2, atLeast: false }} consoles={consoleTabs}>
          <div className="shell"><main className="content" id="page">{node}</main></div>
        </LaunchShell>
      </div>
    </I18nProvider>
  )
  document.body.dataset.mounted = screen
}
void main()
