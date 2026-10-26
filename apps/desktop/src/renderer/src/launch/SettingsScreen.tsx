// #region settings-screen — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#настройки-новый-экран
// Settings as a screen (SCR-52, operator request 2026-10-14), not a band over another page: the coding agents this
// machine can run, how launches fall back between them, whether the computer stays awake, how Fabric looks, and what
// leaves this machine. Every control here is one that already existed; what is new is the agents' catalogue — read
// from Switchboard when it publishes one (0.6.31+), else from Fabric's own detection, with the source said.

import { useEffect, useRef, useState } from 'react'
import { useRead } from './useRead'
import type { SwitchboardCatalog } from '../../../shared/agentCatalog'
import type { LoginItemState } from '../../../shared/loginItem'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { AppSettings, LaunchOption, SettingsPatch } from '../../../shared/types'
import { FallbackOrderSetting } from '../FallbackOrderSetting'
import { UsageCountsSetting } from '../UsageCountsSetting'
import { useT } from '../i18n'
import { FailureNote, MachineDetail } from '../OperatorError'

/** How an agent starts by default: its mode's environment, the program, the mode's arguments (ADR-0168). */
export function launchLine(option: LaunchOption): string | null {
  if (option.program === null) return null
  const mode = option.permissionModes.find((m) => m.id === option.defaultMode)
  const env = Object.entries(mode?.env ?? {}).map(([k, v]) => `${k}=${v}`)
  return [...env, option.program, ...(mode?.args ?? [])].join(' ')
}

/** The agents on this machine: Fabric's own detection, joined with Switchboard's catalogue when it answers.
 *  `permissions` is the choice the «Запуск:» lines depend on: they are read again when it changes (0.3.7 review UX-7). */
export function AgentCatalogPanel({ permissions }: { permissions?: AppSettings['agentPermissions'] } = {}): React.JSX.Element {
  const t = useT()
  const found = useRead<ExecutorRow[]>(() => window.fabric.start.executors())
  const launches = useRead<LaunchOption[]>(() => window.fabric.terminal.options(), permissions)
  const lineOf = new Map((launches && 'value' in launches ? launches.value : []).map((o) => [o.id, launchLine(o)]))
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
          ? t('settings.agents.sourceFailed')
          : catalog.value.source === 'absent' && catalog.value.reason === 'too-old'
            ? t('settings.agents.sourceTooOld')
            : catalog.value.source === 'absent' && catalog.value.reason === 'unknown-schema'
              ? t('settings.agents.sourceUnknownSchema')
            : catalog.value.source === 'absent' && catalog.value.reason === 'refused'
              ? t('settings.agents.sourceRefused')
            : catalog.value.source === 'absent' && catalog.value.reason === 'timeout'
              ? t('settings.agents.sourceTimeout')
            : catalog.value.source === 'absent' && catalog.value.reason === 'not-installed'
              ? t('settings.agents.sourceNone')
              : t('settings.agents.sourceFailed')
  // Why Switchboard's catalogue was not read, in the machine's words, on its own line under our sentence (UX-5).
  const sourceDetail =
    catalog === null || sb ? null
      : 'failed' in catalog ? catalog.failed
        : catalog.value.source === 'absent' && catalog.value.reason !== 'too-old' && catalog.value.reason !== 'not-installed' ? catalog.value.detail
          : null
  const stateOf = (r: ExecutorRow) =>
    r.state === 'found' ? t('settings.agents.found', { version: r.version ?? '' }) : r.state === 'unresponsive' ? t('settings.agents.unresponsive') : t('settings.agents.missing')
  return (
    <section className="lp-panel lp-settings-agents" aria-labelledby="settings-agents-title">
      <div className="lp-panel-head">
        <h4 id="settings-agents-title">{t('settings.agents.title')}</h4>
      </div>
      <p className="lp-meta" role="status">{source}</p>
      <MachineDetail text={sourceDetail} />
      {found === null && <p className="lp-meta">{t('settings.agents.looking')}</p>}
      {found && 'failed' in found && <FailureNote said={t('settings.agents.unreadable')} detail={found.failed} />}
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
              {lineOf.get(r.id) && <p className="lp-meta">{t('settings.agents.command')} <code>{lineOf.get(r.id)}</code></p>}
              {r.state === 'missing' && (r.install ?? s?.install) && (
                <p className="lp-meta">{t('settings.agents.install')} <code>{r.install ?? s?.install}</code></p>
              )}
            </li>
          )
        })}
        {extra.map((a) => (
          <li key={a.id} className={a.installed === false ? 'is-missing' : ''}>
            <div className="lp-settings-row-head">
              <b>{a.name}</b>
              {a.isDefault && <span className="lp-pill attention">{t('settings.agents.default')}</span>}
              {/* Null is Switchboard not saying: that is not "not installed" (0.3.6 review UX-8). */}
              {a.installed !== null && <span className="lp-pill">{a.installed ? t('settings.agents.installed') : t('settings.agents.missing')}</span>}
            </div>
            {a.path && <code className="lp-meta">{a.path}</code>}
            {a.installed === false && a.install && <p className="lp-meta">{t('settings.agents.install')} <code>{a.install}</code></p>}
          </li>
        ))}
      </ol>
      <p className="lp-meta">{t('settings.agents.owner')}</p>
    </section>
  )
}

// #region launch-at-login-setting — docs: AGENTS.md#lifecycle
/**
 * Launch at login (CO-322), drawn only where Fabric registers a login item (macOS and Windows, a packaged build;
 * 0.3.7 review UX-3, ER-3, DO-6). The box is the person's wish; the line under it is what the system itself reports
 * when that differs, read again after every change, so a registration macOS refused or a person turned off in the
 * system's own settings is said rather than hidden behind a checked box.
 */
export function LaunchAtLoginSetting({ value, onChange }: {
  value: boolean
  onChange: (next: SettingsPatch) => Promise<void> | void
}): React.JSX.Element | null {
  const t = useT()
  const read = useRead<LoginItemState>(() => window.fabric.settings.loginItem(), value)
  const state = read && 'value' in read ? read.value : null
  if (!state?.supported) return null
  const darwin = state.platform === 'darwin'
  const system =
    state.system === 'unknown' ? t('settings.launchAtLogin.unknown')
      : value && state.system === 'needs-approval' ? t('settings.launchAtLogin.approval')
        : value && state.system === 'off' ? t(darwin ? 'settings.launchAtLogin.offDarwin' : 'settings.launchAtLogin.offWindows')
          : !value && state.system === 'on' ? t('settings.launchAtLogin.stillOn')
            : null
  return (
    <>
      <label className="lp-check">
        <input type="checkbox" checked={value} onChange={(e) => void onChange({ launchAtLogin: e.target.checked })} />
        {t('settings.launchAtLogin')}
      </label>
      <p className="settings-note">{t(darwin ? 'settings.launchAtLoginNote' : 'settings.launchAtLoginNoteWindows')}</p>
      {system && <p className="settings-note" role="status">{system}</p>}
    </>
  )
}
// #endregion launch-at-login-setting

/** «Сохранено» beside the control whose change saved (SCN-170 step 2, CO-392): a status line, until the next change. */
export function Saved({ on }: { on: boolean }): React.JSX.Element | null {
  const t = useT()
  return on ? <p className="settings-note settings-saved" role="status">{t('settings.saved')}</p> : null
}

/** One permission choice for every agent Fabric starts (CO-305, ADR-0168), and beside it whether the folder a Claude Code
 *  session starts in is marked trusted (CO-348, the operator 2026-10-19: on by default). */
export function AgentPermissionsSetting({ value, onChange, trustFolders = true, saved = null }: {
  value: AppSettings['agentPermissions']
  onChange: (next: SettingsPatch) => Promise<void> | void
  trustFolders?: boolean
  /** Which of this panel's settings saved last, to say «Сохранено» beside it. */
  saved?: string | null
}): React.JSX.Element {
  const t = useT()
  // `FABRIC_TRUST_AGENT_FOLDERS=0` keeps trust off whatever the switch says: the switch then shows what Fabric does, off,
  // cannot be changed here, and says why (0.3.13 review, iteration 1, UX-9). An unread answer keeps the person's switch.
  const override = useRead<boolean>(() => window.fabric.settings.folderTrustLocked())
  const locked = override !== null && 'value' in override && override.value
  const choice = (id: AppSettings['agentPermissions'], label: string, help: string) => (
    <label className="lp-choice">
      <input type="radio" name="agent-permissions" value={id} checked={value === id} onChange={() => void onChange({ agentPermissions: id })} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  )
  return (
    <section className="lp-panel" aria-labelledby="settings-permissions-title">
      <h4 id="settings-permissions-title">{t('settings.permissions.title')}</h4>
      <p className="lp-meta">{t('settings.permissions.lede')}</p>
      <div role="radiogroup" aria-labelledby="settings-permissions-title">
        {choice('fewer-prompts', t('settings.permissions.fewer'), t('settings.permissions.fewerHelp'))}
        {choice('manual', t('settings.permissions.manual'), t('settings.permissions.manualHelp'))}
      </div>
      <Saved on={saved === 'agentPermissions'} />
      {/* CO-348: until 0.3.13 only FABRIC_TRUST_AGENT_FOLDERS=0 turned this off; the variable still does. */}
      <label className="lp-check">
        <input type="checkbox" checked={trustFolders && !locked} disabled={locked}
          aria-describedby={locked ? 'settings-folder-trust-hint settings-folder-trust-locked' : 'settings-folder-trust-hint'}
          onChange={(e) => { if (!locked) void onChange({ trustAgentFolders: e.target.checked }) }} />
        {t('settings.folderTrust')}
      </label>
      <small id="settings-folder-trust-hint" className="lp-meta">{t('settings.folderTrustHelp')}</small>
      {locked && <small id="settings-folder-trust-locked" className="lp-meta">{t('settings.folderTrustLocked')}</small>}
      <Saved on={saved === 'trustAgentFolders'} />
    </section>
  )
}

/**
 * CO-407: whether Claude Code sessions on this computer may message each other (`crossSessionInbound`). It widens what
 * every Claude Code session here accepts, so it is the person's switch, never set by Fabric on its own.
 */
export function AgentLinksSetting(): React.JSX.Element {
  const t = useT()
  const [state, setState] = useState<{ accepting: boolean } | { unreadable: true } | null>(null)
  const [busy, setBusy] = useState(false)
  /** A write that did not happen, said apart from a file that does not read: the switch stays, at what the file holds, so
   *  the person can try again (0.3.12 review UX-8). Main answers a refused write with `notSaved` beside what the file holds
   *  and does not throw (iteration 2, ER-1); a call that itself fails is said the same way, with its error. */
  const [notSaved, setNotSaved] = useState<{ said: string; detail: string } | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.settings.claudeInbound()).then((r) => alive && setState(r), () => alive && setState({ unreadable: true }))
    return () => { alive = false }
  }, [])
  const flip = async (on: boolean): Promise<void> => {
    setBusy(true)
    setNotSaved(null)
    setSaved(false)
    try {
      const answer = await window.fabric.settings.setClaudeInbound(on)
      setState(answer)
      // Saved is what the file now holds matching what was asked (SCN-170 step 2), never a refused write.
      setSaved(!('notSaved' in answer && answer.notSaved) && 'accepting' in answer && answer.accepting === on)
      // A held file is not a refusal: its own sentence, in ours, and only the setting's name beneath (iteration 3, UX-5).
      if ('notSaved' in answer && answer.notSaved)
        setNotSaved(answer.notSaved.reason === 'locked'
          ? { said: t('settings.agentLinks.locked'), detail: t('settings.agentLinks.notSavedDetail') }
          // A link to a settings file that is not there refuses nothing: the file is missing (final candidate, FV-4).
          : answer.notSaved.code === 'ENOENT-link'
            ? { said: t('settings.agentLinks.danglingLink'), detail: t('settings.agentLinks.notSavedDetail') }
            : { said: t('settings.agentLinks.notSaved'), detail: `${t('settings.agentLinks.writeFailed', { code: answer.notSaved.code })} ${t('settings.agentLinks.notSavedDetail')}` })
    } catch (e) {
      setNotSaved({ said: t('settings.agentLinks.notSaved'), detail: `${e instanceof Error ? e.message : String(e)} ${t('settings.agentLinks.notSavedDetail')}` })
      // What the file holds now, read again; a read that fails too is said as the file being unreadable.
      await Promise.resolve().then(() => window.fabric.settings.claudeInbound()).then((r) => setState(r), () => setState({ unreadable: true }))
    } finally { setBusy(false) }
  }
  return (
    <section className="lp-panel" aria-labelledby="settings-agent-links-title">
      <h4 id="settings-agent-links-title">{t('settings.agentLinks.title')}</h4>
      {state === null && <p className="lp-meta">{t('settings.agentLinks.reading')}</p>}
      {state && 'unreadable' in state && <p className="lp-meta" role="status">{t('settings.agentLinks.unreadable')}</p>}
      {notSaved !== null && <FailureNote said={notSaved.said} detail={notSaved.detail} />}
      {state && 'accepting' in state && (
        <label className="lp-check">
          <input type="checkbox" checked={state.accepting} disabled={busy} onChange={(e) => void flip(e.target.checked)} aria-describedby="settings-agent-links-hint" />
          {t('settings.agentLinks.label')}
        </label>
      )}
      <small id="settings-agent-links-hint" className="lp-meta">{t('settings.agentLinks.hint')}</small>
      <Saved on={saved} />
    </section>
  )
}

/** CO-407: the launcher doctor's checks that concern Fabric, read only when the person presses «Проверить». */
export function ReadinessPanel(): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<{ at: 'idle' } | { at: 'checking' } | { at: 'done'; answer: import('../../../shared/fabricReadiness').FabricReadiness }>({ at: 'idle' })
  const check = async (): Promise<void> => {
    setRead({ at: 'checking' })
    try { setRead({ at: 'done', answer: await window.fabric.settings.readiness() }) }
    catch (e) { setRead({ at: 'done', answer: { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) } }) }
  }
  const answer = read.at === 'done' ? read.answer : null
  return (
    <section className="lp-panel" aria-labelledby="settings-readiness-title">
      <div className="lp-panel-head">
        <h4 id="settings-readiness-title">{t('settings.readiness.title')}</h4>
        <button type="button" className="lp-button" disabled={read.at === 'checking'} onClick={() => void check()}>
          {read.at === 'checking' ? t('settings.readiness.checking') : t('settings.readiness.check')}
        </button>
      </div>
      <p className="lp-meta">{t('settings.readiness.lede')}</p>
      {/* Our sentence, then the machine's words beneath it, apart (0.3.12 review UX-18). */}
      {answer && !answer.ok && <FailureNote role="status" said={t(`settings.readiness.failed.${answer.reason}` as 'settings.readiness.failed.failed')} detail={answer.detail} />}
      {answer && answer.ok && (
        <>
          <p className="lp-meta" role="status">{t('settings.readiness.summary', { ok: answer.summary.ok, warn: answer.summary.warn, fail: answer.summary.fail })}</p>
          <ul className="lp-list" aria-label={t('settings.readiness.title')}>
            {answer.checks.map((c) => (
              <li key={c.id}>
                <span className={`lp-pill ${c.state === 'fail' ? 'attention' : ''}`}>{t(`settings.readiness.state.${c.state}` as 'settings.readiness.state.ok')}</span>
                <span>{c.detail}</span>
                {c.fix && <small className="lp-meta">{c.fix}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** One of SCN-170's sections: a small label over what it holds (CO-392's rest). */
function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="settings-group" role="group" aria-labelledby={id}>
      <h3 id={id} className="lp-kicker settings-group-label">{label}</h3>
      {children}
    </div>
  )
}

export function SettingsScreen({ settings, onChange, onOpenHistory, onOpenAccess, onOpen, commsUnread }: {
  settings: AppSettings
  /** Writes the patch; answers why it was not saved (said on this screen, CO-313), or nothing when it was. */
  onChange: (next: SettingsPatch) => Promise<string | null | void> | string | null | void
  onOpenHistory: () => void
  onOpenAccess: () => void
  /** The places that left the rail in 0.3.7 wave 3 (plan §2, "off the rail") and are reached from here until wave 4
   *  gives each its home: the account limits, Help (and the first run), Fabric's name and look, the projects' messages. */
  onOpen?: (to: 'help' | 'persona' | 'comms') => void
  /** Comms threads with new messages, on the button that opens Comms (0.3.7 review UX-4); null while unknown. */
  commsUnread?: { count: number; atLeast: boolean } | null
}): React.JSX.Element {
  const t = useT()
  // The screen is the page's main region while it is open, and its heading takes focus, as the other screens' do (i2 UX-2).
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  // A refused write is said here, pinned to the screen's foot, never only in the shell's banner above a long page (CO-313).
  const [refused, setRefused] = useState<string | null>(null)
  // The setting whose change saved last, said «Сохранено» beside its control (SCN-170 step 2), until the next change.
  const [saved, setSaved] = useState<string | null>(null)
  const change = async (next: SettingsPatch): Promise<void> => {
    setSaved(null)
    const said = await onChange(next)
    setRefused(typeof said === 'string' ? said : null)
    setSaved(typeof said === 'string' ? null : (Object.keys(next)[0] ?? null))
  }
  return (
    <main className="lp lp-settings" data-launch-view="settings">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('settings.screen.kicker')}</p>
          <h2 tabIndex={-1} ref={heading}>{t('settings.screen.title')}</h2>
          <p>{t('settings.screen.body')}</p>
        </div>
      </header>
      {/* SCN-170 step 1, in its order; «Ещё» last (0.3.13, CO-392's rest). */}
      <div className="settings-sections">
        <Section id="settings-look-title" label={t('settings.look.title')}>
          <section className="lp-panel">
            <label className="lp-field">
              {t('settings.theme')}
              <select value={settings.theme} onChange={(e) => void change({ theme: e.target.value as AppSettings['theme'] })}>
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </select>
            </label>
            <Saved on={saved === 'theme'} />
            <label className="lp-field">
              {t('settings.language')}
              <select value={settings.locale} aria-describedby="settings-language-hint" onChange={(e) => void change({ locale: e.target.value as AppSettings['locale'] })}>
                <option value="en">{t('settings.localeEn')}</option>
                <option value="ru">{t('settings.localeRuUntranslated')}</option>
              </select>
            </label>
            {/* P-24: the interface's language is the agents' working language; the field says so. Outside the label, so a
                screen reader hears it once, as the select's description (0.3.11 review, iteration 2, UX-9). */}
            <small id="settings-language-hint" className="lp-meta">{t(settings.agentLanguage === false ? 'settings.languageHintOff' : 'settings.languageHint')}</small>
            <Saved on={saved === 'locale'} />
            {/* OF-38 (the operator's walk, 2026-10-23): on by default; off keeps the language the agents speak by themselves. */}
            <label className="lp-check">
              <input type="checkbox" checked={settings.agentLanguage !== false} onChange={(e) => void change({ agentLanguage: e.target.checked })} />
              {t('settings.agentLanguage')}
            </label>
            <Saved on={saved === 'agentLanguage'} />
          </section>
        </Section>
        <Section id="settings-computer-title" label={t('settings.computer.title')}>
          <section className="lp-panel">
            <label className="lp-field">
              {t('power.label')}
              <select value={settings.keepAwake} onChange={(e) => void change({ keepAwake: e.target.value as AppSettings['keepAwake'] })}>
                <option value="always">{t('power.always')}</option>
                <option value="while-working">{t('power.while-working')}</option>
                <option value="never">{t('power.never')}</option>
              </select>
            </label>
            {/* Said here rather than discovered: the blocker stops the MACHINE suspending and lets the screen sleep,
                and macOS ignores it with the lid closed on battery. */}
            <p className="settings-note">{t('power.note')}</p>
            <Saved on={saved === 'keepAwake'} />
            <LaunchAtLoginSetting value={settings.launchAtLogin !== false} onChange={change} />
            <Saved on={saved === 'launchAtLogin'} />
            {/* ADR-0176 §3: whose computer this is decides whether an agent here may make another project's change
                itself when that project's agent is offline. Never assumed: not said reads as not the operator's. */}
            <label className="lp-field">
              {t('settings.machineTrust')}
              <select
                value={settings.machineTrust ?? ''}
                aria-describedby="settings-machine-trust-hint"
                onChange={(e) => void change({ machineTrust: e.target.value === 'mine' || e.target.value === 'organization' ? e.target.value : null })}
              >
                <option value="">{t('settings.machineTrust.unset')}</option>
                <option value="mine">{t('settings.machineTrust.mine')}</option>
                <option value="organization">{t('settings.machineTrust.organization')}</option>
              </select>
            </label>
            <small id="settings-machine-trust-hint" className="lp-meta">
              {t(settings.machineTrust === 'mine' ? 'settings.machineTrust.hintMine' : settings.machineTrust === 'organization' ? 'settings.machineTrust.hintOrganization' : 'settings.machineTrust.hintUnset')}
            </small>
            <Saved on={saved === 'machineTrust'} />
          </section>
          <ReadinessPanel />
        </Section>
        <Section id="settings-launch-group" label={t('settings.launch.group')}>
          <AgentPermissionsSetting value={settings.agentPermissions ?? 'fewer-prompts'} onChange={change} trustFolders={settings.trustAgentFolders !== false} saved={saved} />
          <AgentCatalogPanel permissions={settings.agentPermissions ?? 'fewer-prompts'} />
          <section className="lp-panel" aria-labelledby="settings-launch-title">
            <h4 id="settings-launch-title">{t('settings.launch.title')}</h4>
            <FallbackOrderSetting value={settings.runnerFallback} onChange={change} />
            <Saved on={saved === 'runnerFallback'} />
          </section>
          <AgentLinksSetting />
        </Section>
        <Section id="settings-data-title" label={t('settings.data.title')}>
          <section className="lp-panel">
            <UsageCountsSetting />
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={onOpenHistory}>{t('settings.history')}</button>
            </div>
          </section>
        </Section>
        <Section id="settings-access-title" label={t('settings.agentAccess')}>
          <section className="lp-panel">
            <p className="lp-meta">{t('settings.access.lede')}</p>
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={onOpenAccess}>{t('settings.access.open')}</button>
            </div>
          </section>
        </Section>
        {onOpen && (
          <Section id="settings-more-title" label={t('settings.more.title')}>
            <section className="lp-panel">
              <div className="lp-actions">
                {/* D-3 (the operator's walk, 2026-10-22): account quotas are Switchboard's; Fabric no longer shows its own. */}
                <button type="button" className="lp-button" onClick={() => onOpen('comms')}>
                  {t('settings.more.comms')}
                  {commsUnread && commsUnread.count > 0 && (
                    <>
                      {' '}
                      <span className="lp-pill attention" aria-label={t(commsUnread.atLeast ? 'rail.commsUnreadMax' : 'rail.commsUnread', { count: commsUnread.count })}>
                        {commsUnread.count}{commsUnread.atLeast ? '+' : ''}
                      </span>
                    </>
                  )}
                </button>
                <button type="button" className="lp-button" onClick={() => onOpen('persona')}>{t('settings.more.persona')}</button>
                <button type="button" className="lp-button" onClick={() => onOpen('help')}>{t('settings.more.help')}</button>
              </div>
            </section>
          </Section>
        )}
      </div>
      {refused !== null && (
        <div className="lp-callout lp-settings-refused" role="alert">
          <p>{t('settings.notSaved', { reason: refused })}</p>
          <button type="button" className="lp-button" onClick={() => setRefused(null)}>{t('settings.notSavedClose')}</button>
        </div>
      )}
    </main>
  )
}
// #endregion settings-screen
