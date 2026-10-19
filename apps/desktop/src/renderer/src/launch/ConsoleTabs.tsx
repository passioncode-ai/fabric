// #region console-tabs-strip — docs: docs/ux/scenarios.md#scn-172-keep-several-consoles-open-as-tabs-along-the-top-and-switch-between-them
// The open consoles as tabs along the top of the main window (OF-03, SCN-172). The rail on the left stays the projects
// and the places; these are the only tabs at the top. Each tab: the console sign, its project's name, its coding agent.
// × takes the tab away and asks nothing: the session goes on running in the main process (ADR-0031 §2), and it is
// opened again from wherever its console is offered. Not there at all while no console is open.

import { useT } from '../i18n'

export interface ConsoleTab {
  sessionId: string
  /** The project's name, else the folder's last part; null while the session has not been read. */
  title: string | null
  /** The coding agent, as `runnerLabel` calls it; null while unknown. */
  runner: string | null
}

export function ConsoleTabs({
  tabs,
  activeId,
  onSelect,
  onClose
}: {
  tabs: readonly ConsoleTab[]
  /** The console on screen, or null when the person is at a place or a project. */
  activeId: string | null
  onSelect(sessionId: string): void
  onClose(sessionId: string): void
}): React.JSX.Element | null {
  const t = useT()
  if (tabs.length === 0) return null
  return (
    <nav className="fab-consoles" aria-label={t('consoles.label')}>
      <ul>
        {tabs.map((tab) => {
          const on = tab.sessionId === activeId
          const name = tab.title ?? t('consoles.reading')
          return (
            <li key={tab.sessionId} className={on ? 'fab-console on' : 'fab-console'}>
              <button type="button" className="fab-console-open" aria-current={on ? 'page' : undefined}
                title={tab.runner ? t('consoles.tabTitle', { name, runner: tab.runner }) : name} onClick={() => onSelect(tab.sessionId)}>
                <span className="fab-console-sign" aria-hidden="true">{t('glyph.console')}</span>
                <span className="fab-console-name">{name}</span>
                {tab.runner && <span className="fab-console-runner">{tab.runner}</span>}
              </button>
              <button type="button" className="fab-console-close" aria-label={t('consoles.close', { name })}
                onClick={() => onClose(tab.sessionId)}>
                <span aria-hidden="true">{t('glyph.close')}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
// #endregion console-tabs-strip
