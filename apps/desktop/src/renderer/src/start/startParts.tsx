// Pieces every start path shares (SCR-70…SCR-75): the heading that takes focus, the facts about a folder, the
// copy button and the sentence a refusal becomes. Their own module so the agent paths (`AgentPaths.tsx`) and the
// project paths (`StartPaths.tsx`) use one of each without importing each other.

import { humaniseError } from '../../../shared/errorText'
import { useEffect, useRef, useState } from 'react'
import { purposeFromRepository, type CandidateView, type FolderView } from '../../../shared/startPaths.ts'
import type { Translate } from '../i18n'
import { useT } from '../i18n'

/**
 * An error as the operator reads it: the transport's wrapping removed by the app's one rule
 * (`shared/errorText.ts`, M106c), so the sentence that remains is the main process's own.
 */
export const errorText = (e: unknown): string => humaniseError(e).detail

/**
 * An error, with the refusals main sends as codes said in this window's language: a repository path the
 * window did not choose (`repo-path-refused:<code>: <path>`, startChoices.ts) reads as a sentence.
 */
export function explainError(e: unknown, t: Translate): string {
  const text = errorText(e)
  const repo = /(?:^|: )repo-path-refused:(not-a-path|missing|not-a-folder|not-chosen|too-broad|held-by-other): ([\s\S]*)$/.exec(text)
  if (repo) return t(`start.repoRefused.${repo[1]}` as 'start.repoRefused.not-chosen', { path: repo[2] })
  const folder = /(?:^|: )folder-refused:(missing|not-a-folder|unreadable|timeout|outside): ([\s\S]*)$/.exec(text)
  if (folder) return t(`start.folderRefused.${folder[1]}` as 'start.folderRefused.missing', { path: folder[2] })
  const name = /(?:^|: )project-name-refused:(not-a-name|empty|text-direction|control)\b/.exec(text)
  if (name) return t(`start.projectNameRefused.${name[1]}` as 'start.projectNameRefused.empty')
  const task = /(?:^|: )task-refused:(not-an-id|other-project|read-failed|readback-failed)(?:: ([\s\S]*))?$/.exec(text)
  if (task) return t(`start.taskRefused.${task[1]}` as 'start.taskRefused.not-an-id', { detail: task[2] ?? '' })
  const agent = /(?:^|: )agent-name-refused:taken: ([\s\S]*)$/.exec(text)
  if (agent) return t('agents.nameTaken', { name: agent[1] })
  return text
}

/** The purpose a Project made from this folder gets: the repository's words, saying whose they are (ER-5). */
export const purposeFrom = (f: { summary?: string | null; summaryFile?: string | null }, t: Translate): string | undefined =>
  purposeFromRepository(f, (file, text) => t('start.purposeFromRepo', { file, text }))

/** A refusal said as a sentence, without its own closing full stop, for templates that continue after it. */
export const reasonOf = (e: unknown, t: Translate): string => explainError(e, t).replace(/\.\s*$/, '')

/** A commit time as the operator reads it: a date in their locale, never a raw ISO string. */
export function shortDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Heading({ kicker, title, lede, back }: { kicker: string; title: string; lede: string; back?: { label: string; onClick: () => void; disabled?: boolean } }): React.JSX.Element {
  // Each path mounts its own heading, and focus lands on it: a keyboard or screen-reader user hears
  // where they arrived instead of staying on a button that is gone (iteration 2: focus stayed on BODY).
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <header className="lp-heading">
      <div>
        <p className="lp-kicker">{kicker}</p>
        <h2 tabIndex={-1} ref={ref}>{title}</h2>
        <p>{lede}</p>
      </div>
      {back && <div className="lp-actions"><button type="button" className="lp-button" disabled={back.disabled} onClick={back.onClick}>{back.label}</button></div>}
    </header>
  )
}

// ── Facts about a folder ────────────────────────────────────────────────────

export function FolderFactsList({ f, t, locale }: { f: FolderView | CandidateView; t: Translate; locale: string }): React.JSX.Element {
  return (
    <dl className="st-facts">
      <dt>{t('start.facts.path')}</dt>
      <dd><code>{f.path}</code></dd>
      <dt>{t('start.facts.git')}</dt>
      <dd>{t(`start.kind.${f.kind}` as 'start.kind.repository')}{f.branch ? ` · ${f.branch}` : ''}</dd>
      {f.remote && <><dt>{t('start.facts.remote')}</dt><dd><code>{f.remote}</code></dd></>}
      {f.lastCommit && <><dt>{t('start.facts.lastCommit')}</dt><dd>{shortDate(f.lastCommit.at, locale)} · {f.lastCommit.subject}</dd></>}
      {f.stack.length > 0 && <><dt>{t('start.facts.stack')}</dt><dd>{f.stack.join(', ')}</dd></>}
      {/* What the repository says it is; it becomes the project's purpose, which can be changed later. */}
      {f.summary && <><dt>{t('start.facts.summary')}</dt><dd>{f.summary}</dd></>}
    </dl>
  )
}

/** Copy a command; says Copied only when the clipboard took it. */
export function CopyButton({ text }: { text: string }): React.JSX.Element {
  const t = useT()
  // A copy that fails says so: the command stays selectable on screen (iteration 2: a refused clipboard was silent).
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button type="button" className="lp-button" onClick={() => { void navigator.clipboard.writeText(text).then(() => setState('copied'), () => setState('failed')) }}>
      {state === 'copied' ? t('first.exec.copied') : state === 'failed' ? t('first.exec.copyFailed') : t('first.exec.copy')}
    </button>
  )
}
