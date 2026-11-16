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
import '../src/renderer/src/tokens.paperclip.css'
import '../src/renderer/src/tokens.passioncode.css'
import '../src/renderer/src/tokens.app.css'
import '../src/renderer/src/styles.css'
import '../src/renderer/src/components.css'
import '../src/renderer/src/launch/launch.css'
import '../src/renderer/src/launch/rail.css'
import '../src/renderer/src/start/start.css'
import { fakeApi } from './fakeApi'
import { NOW, agent, fixtures, project, projects, tasks } from './fixtures'

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
  if (screen === 'agent') {
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
  } else {
    node = <p>unknown screen {screen}</p>
  }
  createRoot(document.getElementById('root')!).render(
    <I18nProvider locale={locale}>
      <div className="app launch-root">
        <div className="fab-shell">
          <aside className="rail" aria-label="rail"><div className="rail-brand"><b>Fabric</b></div></aside>
          <div className="fab-main"><header className="fab-top" /><div className="fab-place"><div className="shell"><main className="content" id="page">{node}</main></div></div></div>
        </div>
      </div>
    </I18nProvider>
  )
  document.body.dataset.mounted = screen
}
void main()
