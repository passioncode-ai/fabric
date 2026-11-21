// #region session-meta-line — docs: docs/ux/scenarios.md#scn-188-read-a-consoles-system-line
/**
 * A console's system line, in its bottom bar (the owner, 2026-11-20: «внизу в строчечке … системную … аккаунт … кто ее
 * вытащил … папка, ветка … мета информация»): who started it and how, the account, the organisation, the runner and
 * model, the folder (opens in Finder), the branch, the two ids (copied on a press). One line: each part is cut to fit
 * and says itself whole on hover; a part main could not read is left out. Read on opening, every 30 s while the window
 * is seen, and when the window comes back into view, so an account Switchboard switched to shows within half a minute.
 */
import { useCallback, useEffect, useState } from 'react'
import type { SessionMeta } from '../../shared/sessionMeta'
import { modelLabel } from '../../shared/sessionMeta'
import { shortFolder } from './consoles'
import { useLocale, useT } from './i18n'
import type { StringKey } from './i18n/en'
import { runnerLabel } from './runnerLabel'
import { visibleInterval } from './visibleClock'

export const META_REFRESH_MS = 30_000

/** Git's branch sign, 12 px, in the text's colour. */
function BranchIcon(): React.JSX.Element {
  return (
    <svg className="session-meta-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="4.5" cy="3.5" r="1.6" /><circle cx="4.5" cy="12.5" r="1.6" /><circle cx="11.5" cy="5.5" r="1.6" />
      <path d="M4.5 5.1v5.8M11.5 7.1c0 2.6-3.5 2.4-6.2 4" />
    </svg>
  )
}

const BY_KEYS: Record<string, StringKey> = {
  person: 'session.meta.by.person', ceo: 'session.meta.by.ceo', routine: 'session.meta.by.routine', chain: 'session.meta.by.chain',
  answer: 'session.meta.by.answer', 'board-dispatch': 'session.meta.by.board', restore: 'session.meta.by.restore', fabric: 'session.meta.by.fabric',
  switchboard: 'session.meta.by.switchboard'
}

export function SessionMetaLine({ sessionId, fallback = null }: { sessionId: string; fallback?: React.ReactNode }): React.JSX.Element | null {
  const t = useT()
  const locale = useLocale()
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const read = useCallback(() => {
    const api = window.fabric?.terminal
    if (typeof api?.meta !== 'function') return
    // A failed read keeps the line it had: it is a caption, not a verdict, and the next read comes in 30 s.
    api.meta(sessionId).then((m) => { if (m) setMeta(m) }, () => undefined)
  }, [sessionId])
  useEffect(() => {
    read()
    const off = visibleInterval(read, META_REFRESH_MS)
    window.addEventListener('focus', read)
    return () => { off(); window.removeEventListener('focus', read) }
  }, [read])
  if (!meta) return <>{fallback}</>
  const time = (iso: string | null): string => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '')
  const copy = (text: string): void => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(text); setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500) }, () => undefined)
  }
  const who = meta.started ? t(BY_KEYS[meta.started.by] ?? 'session.meta.by.fabric') : null
  const startedWords = meta.handedOver
    ? t('session.meta.handedOver', { time: time(meta.handedOver.at) })
    : who ? (meta.started?.via === 'voice' ? t('session.meta.startedVoice', { who, time: time(meta.started.at) }) : t('session.meta.started', { who, time: time(meta.started?.at ?? null) })) : null
  const context = meta.context === 'personal' ? t('session.meta.personal') : meta.context
  // The agent's name is the tab's and the title's already: the line names the model, the agent whole on hover.
  const runner = [runnerLabel(meta.runner, t), modelLabel(meta.model)].filter(Boolean).join(' · ')
  const model = modelLabel(meta.model) ?? runnerLabel(meta.runner, t)
  // The folder by its own name (the part that tells two apart), its whole path on hover (design review F1).
  const folderName = meta.folder.replace(/\/+$/, '').split('/').pop() || shortFolder(meta.folder)
  return (
    <span className="session-meta" aria-label={t('session.meta.label')}>
      {startedWords && <span className="session-meta-item is-started" title={meta.started?.parentSessionId ? `${startedWords}. ${t('session.meta.parent')}` : startedWords}>{startedWords}</span>}
      {meta.account && (
        <span className="session-meta-item" title={t(meta.account.source === 'group-route' ? 'session.meta.accountRoute' : 'session.meta.account', { label: meta.account.label })}>{meta.account.short}</span>
      )}
      {context && <span className="session-meta-item is-soft" title={t('session.meta.context', { name: context })}>{context}</span>}
      <span className="session-meta-item is-model" title={runner}>{model}</span>
      <button type="button" className="session-meta-item session-meta-press mono is-folder" title={t('session.meta.folder', { path: meta.folder })}
        onClick={() => { void window.fabric.terminal.revealFolder(sessionId).catch(() => undefined) }}>{folderName}</button>
      {meta.branch && <span className="session-meta-item mono is-branch" title={t('session.meta.branch', { branch: meta.branch })}><BranchIcon />{meta.branch}</span>}
      <button type="button" className="session-meta-item session-meta-press mono is-id" title={t('session.meta.id')}
        onClick={() => copy(meta.sessionId)}>{t('session.meta.idShort')}</button>
      {meta.runnerSessionId && meta.runnerSessionId !== meta.sessionId && (
        <button type="button" className="session-meta-item session-meta-press mono is-id is-extra" title={t('session.meta.runnerId')}
          onClick={() => copy(meta.runnerSessionId!)}>{t('session.meta.runnerIdShort')}</button>
      )}
      {/* The copy is said here, so the id keeps its width and a screen reader hears it (design review F8). */}
      <span className="session-meta-copied" role="status" aria-live="polite">{copied ? t('session.meta.copied') : ''}</span>
    </span>
  )
}
// #endregion session-meta-line
