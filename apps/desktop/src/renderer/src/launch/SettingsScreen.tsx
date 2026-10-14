// #region settings-screen — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#настройки-новый-экран
// Settings as a screen (SCR-52, operator request 2026-10-14), not a band over another page: the coding agents this
// machine can run, how launches fall back between them, whether the computer stays awake, how Fabric looks, and what
// leaves this machine. Every control here is one that already existed; what is new is the agents' catalogue — read
// from Switchboard when it publishes one (0.6.31+), else from Fabric's own detection, with the source said.

import { useRead } from './useRead'
import type { SwitchboardCatalog } from '../../../shared/agentCatalog'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { AppSettings, SettingsPatch } from '../../../shared/types'
import { FallbackOrderSetting } from '../FallbackOrderSetting'
import { UsageCountsSetting } from '../UsageCountsSetting'
import { useT } from '../i18n'

/** The agents on this machine: Fabric's own detection, joined with Switchboard's catalogue when it answers. */
export function AgentCatalogPanel(): React.JSX.Element {
  const t = useT()
  const found = useRead<ExecutorRow[]>(() => window.fabric.start.executors())
  const catalog = useRead<SwitchboardCatalog>(() => window.fabric.settings.agentCatalog())
  const sb = catalog && 'value' in catalog && catalog.value.source === 'switchboard' ? catalog.value : null
  const byId = new Map((sb?.agents ?? []).map((a) => [a.id, a]))
  const rows = found && 'value' in found ? found.value : []
  // Agents Switchboard knows that Fabric's detection does not list.
  const extra = (sb?.agents ?? []).filter((a) => !rows.some((r) => r.id === a.id))
  const source =
    catalog === null
      ? t('settings.agents.sourceReading')
      : sb
        ? t('settings.agents.sourceSwitchboard')
        : 'failed' in catalog
          ? t('settings.agents.sourceFailed', { reason: catalog.failed })
          : catalog.value.source === 'absent' && catalog.value.reason === 'too-old'
            ? t('settings.agents.sourceTooOld')
            : catalog.value.source === 'absent' && catalog.value.reason === 'not-installed'
              ? t('settings.agents.sourceNone')
              : t('settings.agents.sourceFailed', { reason: (catalog.value.source === 'absent' && catalog.value.detail) || '' })
  const stateOf = (r: ExecutorRow) =>
    r.state === 'found' ? t('settings.agents.found', { version: r.version ?? '' }) : r.state === 'unresponsive' ? t('settings.agents.unresponsive') : t('settings.agents.missing')
  return (
    <section className="lp-panel lp-settings-agents" aria-labelledby="settings-agents-title">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('settings.agents.kicker')}</p>
          <h3 id="settings-agents-title">{t('settings.agents.title')}</h3>
        </div>
      </div>
      <p className="lp-meta" role="status">{source}</p>
      {found === null && <p className="lp-meta">{t('settings.agents.looking')}</p>}
      {found && 'failed' in found && <p className="lp-meta" role="alert">{t('settings.agents.unreadable', { reason: found.failed })}</p>}
      <ol className="lp-settings-list">
        {rows.map((r) => {
          const s = byId.get(r.id)
          return (
            <li key={r.id} className={r.state === 'found' ? '' : 'is-missing'}>
              <div className="lp-settings-row-head">
                <b>{r.label}</b>
                {s?.isDefault && <span className="lp-pill attention">{t('settings.agents.default')}</span>}
                {s?.enabled === false && <span className="lp-pill">{t('settings.agents.disabled')}</span>}
                <span className="lp-pill">{stateOf(r)}</span>
              </div>
              {r.path && <code className="lp-meta">{r.path}</code>}
              {r.state === 'missing' && (r.install ?? s?.install) && (
                <p className="lp-meta">{t('settings.agents.install')} <code>{r.install ?? s?.install}</code></p>
              )}
            </li>
          )
        })}
        {extra.map((a) => (
          <li key={a.id} className={a.installed ? '' : 'is-missing'}>
            <div className="lp-settings-row-head">
              <b>{a.name}</b>
              {a.isDefault && <span className="lp-pill attention">{t('settings.agents.default')}</span>}
              <span className="lp-pill">{a.installed ? t('settings.agents.installed') : t('settings.agents.missing')}</span>
            </div>
            {a.path && <code className="lp-meta">{a.path}</code>}
            {!a.installed && a.install && <p className="lp-meta">{t('settings.agents.install')} <code>{a.install}</code></p>}
          </li>
        ))}
      </ol>
      <p className="lp-meta">{t('settings.agents.owner')}</p>
    </section>
  )
}

export function SettingsScreen({ settings, onChange, onOpenHistory, onOpenAccess }: {
  settings: AppSettings
  onChange: (next: SettingsPatch) => Promise<void> | void
  onOpenHistory: () => void
  onOpenAccess: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="lp lp-settings" data-launch-view="settings">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('settings.screen.kicker')}</p>
          <h2 tabIndex={-1}>{t('settings.screen.title')}</h2>
          <p>{t('settings.screen.body')}</p>
        </div>
      </header>
      <div className="lp-project-grid">
        <div>
          <AgentCatalogPanel />
          <section className="lp-panel" aria-labelledby="settings-launch-title">
            <p className="lp-kicker">{t('settings.launch.kicker')}</p>
            <h3 id="settings-launch-title">{t('settings.launch.title')}</h3>
            <FallbackOrderSetting value={settings.runnerFallback} onChange={onChange} />
          </section>
        </div>
        <aside className="lp-side">
          <section className="lp-panel" aria-labelledby="settings-computer-title">
            <h3 id="settings-computer-title">{t('settings.computer.title')}</h3>
            <label className="lp-field">
              {t('power.label')}
              <select value={settings.keepAwake} onChange={(e) => void onChange({ keepAwake: e.target.value as AppSettings['keepAwake'] })}>
                <option value="always">{t('power.always')}</option>
                <option value="while-working">{t('power.while-working')}</option>
                <option value="never">{t('power.never')}</option>
              </select>
            </label>
            {/* Said here rather than discovered: the blocker stops the MACHINE suspending and lets the screen sleep,
                and macOS ignores it with the lid closed on battery. */}
            <p className="settings-note">{t('power.note')}</p>
          </section>
          <section className="lp-panel" aria-labelledby="settings-look-title">
            <h3 id="settings-look-title">{t('settings.look.title')}</h3>
            <label className="lp-field">
              {t('settings.theme')}
              <select value={settings.theme} onChange={(e) => void onChange({ theme: e.target.value as AppSettings['theme'] })}>
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </select>
            </label>
            <label className="lp-field">
              {t('settings.language')}
              <select value={settings.locale} onChange={(e) => void onChange({ locale: e.target.value as AppSettings['locale'] })}>
                <option value="en">{t('settings.localeEn')}</option>
                <option value="ru">{t('settings.localeRuUntranslated')}</option>
              </select>
            </label>
          </section>
          <section className="lp-panel" aria-labelledby="settings-data-title">
            <h3 id="settings-data-title">{t('settings.data.title')}</h3>
            <UsageCountsSetting />
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={onOpenHistory}>{t('settings.history')}</button>
              <button type="button" className="lp-button" onClick={onOpenAccess}>{t('settings.agentAccess')}</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
// #endregion settings-screen
