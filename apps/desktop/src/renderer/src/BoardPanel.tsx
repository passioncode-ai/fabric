// What needs the owner, ranked, at one of three scales (M151).
//
// ONE QUERY, THREE SCALES. The estate home shows five, a project shows ten, and
// the full list shows everything — and they are the same query with a different
// cut, so the badge on the home and the list inside the project can never
// disagree. Two similar queries are two answers that can differ, and the
// operator would be told about something the panel does not show.
//
// AN AUTHORED QUESTION AND A DERIVED OBLIGATION LOOK DIFFERENT HERE, because
// they end differently: one waits for an ANSWER, the other leaves when the
// state changes. Neither can be dismissed, and there is no control that would
// suggest otherwise — a queue you can mark as read is a queue that lies.

import { useEffect, useRef, useState } from 'react'
import type { BoardCut, BoardEntry } from '../../shared/board'
import type { ReadEnvelope } from '../../shared/readEnvelope'
import type { AnswerReceipt } from '../../shared/types'
import { summariseAnswer } from '../../shared/answerReceipt.ts'
import { Banner, Button, EmptyState, Field, Panel, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { titleOf } from './attentionTitle'
import { since } from './duration'

export function BoardPanel({
  projectId = null,
  limit = 5,
  feedMark
}: {
  projectId?: string | null
  limit?: number
  /** Re-read on the journal's clock, so the board does not disagree with the
   *  feed beside it. */
  feedMark: number
}): React.JSX.Element {
  const t = useT()
  const [view, setView] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  /** Kept across a refusal. A conflict that clears what the operator typed
   *  makes them write it twice to find out it was refused twice. */
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [receipt, setReceipt] = useState<Record<string, AnswerReceipt>>({})
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // Wrapped, because this panel sits at the TOP of the estate home and a
    // throw inside the effect blanks the page under it. M106's lesson: a window
    // that cannot read what it is for says so, where before the diagnosis sat
    // in state one branch above the banner that would have shown it.
    try {
      void window.fabric.board.query({ projectId, limit }).then(
        (v) => alive && setView(v),
        (e: unknown) => alive && setProblem(e instanceof Error ? e.message : String(e))
      )
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
    return () => {
      alive = false
    }
  }, [projectId, limit, feedMark])

  const cut = view?.data ?? null
  const unread = (view?.sources ?? []).filter((s) => s.status !== 'ok')

  return (
    <Panel id="sec-board" title={t('needsYou.title')}>
      <p className="muted">{t('needsYou.lede')}</p>

      {problem && <Banner tone="error">{t('needsYou.unreadable', { reason: problem })}</Banner>}

      {/* A source that failed must never render as a quiet board. This is the
          difference between "nothing needs you" and "we could not look". */}
      {unread.length > 0 && (
        <Banner tone="warn">
          {t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}
        </Banner>
      )}

      {cut && cut.total === 0 && unread.length === 0 && (
        <EmptyState read>{t('needsYou.clear')}</EmptyState>
      )}

      {cut?.items.map((item: BoardEntry) => (
        <Row
          key={item.ref}
          lead={
            <StateChip tone={item.origin === 'authored' ? 'warn' : 'quiet'}>
              {t(`needsYou.kind.${item.kind}` as 'needsYou.kind.question')}
            </StateChip>
          }
          trail={
            <span className="muted">
              {item.projectName ? `${item.projectName} · ` : ''}
              {since(item.waitingSince, t)}
            </span>
          }
        >
          {/* The whole row opens it. A question is answered from here or it is
              not answered — a link to somewhere else is a step that does not
              happen at eleven at night. */}
          <Button
            tone="quiet"
            onClick={() => setOpen(open === item.ref ? null : item.ref)}
          >
            {titleOf(item, t)}
          </Button>
          {item.detail && <span className="muted"> · {item.detail}</span>}

          {open === item.ref && item.question && (
            <AnswerForm
              item={item}
              draft={draft[item.ref] ?? ''}
              onDraft={(v) => setDraft((d) => ({ ...d, [item.ref]: v }))}
              receipt={receipt[item.ref]}
              sending={sending === item.ref}
              onSubmit={async (chosenOption) => {
                setSending(item.ref)
                try {
                  const r = await submitAnswer(item, draft[item.ref] ?? '', chosenOption)
                  setReceipt((m) => ({ ...m, [item.ref]: r }))
                  // The draft survives a refusal on purpose; a commit clears it.
                  if (r.committed) setDraft((d) => ({ ...d, [item.ref]: '' }))
                } finally {
                  setSending(null)
                }
              }}
            />
          )}
        </Row>
      ))}

      {cut && cut.hidden > 0 && (
        <p className="muted">{t('needsYou.hidden', { count: cut.hidden, total: cut.total })}</p>
      )}
    </Panel>
  )
}

/** One command id per question per session, so a double click and a retry after
 *  a lost response are ONE command. A fresh id per click would make the second
 *  press a second decision. */
const commands = new Map<string, string>()
function commandFor(ref: string): string {
  const existing = commands.get(ref)
  if (existing) return existing
  const id = crypto.randomUUID()
  commands.set(ref, id)
  return id
}

/**
 * Answer one authored question — the one writer every surface that answers goes through.
 *
 * The SUBJECT comes off the entry. This used to slice a fixed prefix off the ref string — a
 * parse the compiler cannot check, against a format that has changed twice. The command id is
 * stable per attempt, so a retry after a lost response returns the first commit rather than
 * making a second decision.
 */
export function submitAnswer(item: BoardEntry, answer: string, chosenOption?: string): Promise<AnswerReceipt> {
  return window.fabric.questions.answer({
    commandId: commandFor(item.ref),
    questionId: item.subject.id,
    projectId: item.projectId ?? '',
    expectedRevision: item.question!.revision,
    answer,
    chosenOption,
    options: item.question!.options
  })
}

export function AnswerForm({
  item,
  draft,
  onDraft,
  receipt,
  sending,
  onSubmit,
  look = 'panel'
}: {
  item: BoardEntry
  draft: string
  onDraft: (v: string) => void
  receipt?: AnswerReceipt
  sending: boolean
  onSubmit: (chosenOption?: string) => void
  /** 'launch' renders the launch design's field and buttons (SCR-41 details); the logic is one. */
  look?: 'panel' | 'launch'
}): React.JSX.Element {
  const t = useT()
  const options = item.question?.options ?? []

  // M152 — TWO FACTS, NOT ONE BANNER. This used to say "answered · N eligible"
  // and show nothing about the delivery, so an answer whose session had already
  // ended read as the full closed loop. The commit and where the answer went
  // are different outcomes with different next acts.
  if (receipt?.committed) {
    const summary = summariseAnswer({
      committed: true,
      // The estate's own answer to "did I just record this twice?". It crossed
      // this boundary on every commit and was read by nothing until AX-03.
      repeated: receipt.repeated,
      unblocked: receipt.unblocked,
      stillBlocked: receipt.stillBlocked,
      continuations: receipt.continuations ?? []
    })
    if (look === 'launch')
      return (
        <div className="lp-callout" role="status">
          <b>{t('launch.board.recorded')}</b>
          {summary.lines.map((line, i) => <p key={`${line.kind}-${i}`}>{line.says}</p>)}
        </div>
      )
    return (
      <div>
        {summary.lines.map((line, i) =>
          // A confirmation is not an alert. `Banner` carries role="alert", and
          // announcing "the answer is recorded" that way is wrong for anyone
          // listening rather than looking — so good news is ordinary text and
          // only the things that need attention are banners.
          line.tone === 'warn' ? (
            <Banner key={`${line.kind}-${i}`} tone="warn">
              {line.says}
            </Banner>
          ) : (
            <p key={`${line.kind}-${i}`} className="muted">
              {line.says}
            </p>
          )
        )}
      </div>
    )
  }

  if (look === 'launch')
    return (
      <div>
        {receipt && !receipt.committed && <div className="lp-callout" role="alert"><p>{receipt.reason}</p></div>}
        {options.length > 0 && (
          <div className="lp-actions" role="group" aria-label={t('launch.board.options')}>
            {options.map((o) => (
              <button key={o.id} type="button" className="lp-button" disabled={sending} title={o.consequence} onClick={() => onSubmit(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        <label className="lp-field">
          {t('launch.board.outcome')}
          <textarea rows={3} value={draft} placeholder={t('launch.board.outcomeHint')} onChange={(e) => onDraft(e.target.value)} />
        </label>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" disabled={sending || !draft.trim()} onClick={() => onSubmit()}>
            {sending ? t('needsYou.sending') : t('launch.board.record')}
          </button>
        </div>
      </div>
    )
  return (
    <div>
      {receipt && !receipt.committed && <Banner tone="warn">{receipt.reason}</Banner>}
      {options.map((o) => (
        <Toolbar key={o.id} align="start">
          <Button tone="primary" disabled={sending} onClick={() => onSubmit(o.id)}>
            {o.label}
          </Button>
          {o.consequence && <span className="muted">{o.consequence}</span>}
        </Toolbar>
      ))}
      <Field label={t('needsYou.answerLabel')}>
        {(id) => <textarea id={id} value={draft} onChange={(e) => onDraft(e.target.value)} rows={2} />}
      </Field>
      <Toolbar align="end">
        <Button tone="primary" disabled={sending || !draft.trim()} onClick={() => onSubmit()}>
          {sending ? t('needsYou.sending') : t('needsYou.submit')}
        </Button>
      </Toolbar>
    </div>
  )
}
