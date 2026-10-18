// The act line (ADR-0160 §1, SCN-169; 0.3.7 wave 3): after an act the place shows one quiet line at its foot,
// «{что сделано} · Отменить», wired to wave 2's `acts.undo`. No toast, no banner, no dialog. A refused undo changes
// nothing and says why in our words, the machine's beneath; an act with no inverse says why it cannot be undone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { translator } from '../i18n/translate'
import type { ActAnswer, ActRecord } from '../../../shared/acts.ts'
import { ActLine, latestPersonAct, type LineAct } from './ActLine'
import { actSentence, whyWords } from './actWords'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const record = (over: Partial<ActRecord> = {}): ActRecord => ({
  v: 1, kind: 'task.move', category: 'tasks', subject: { type: 'task', id: 't1', label: 'Build on macOS 15' },
  said: { key: 'act.task.move', params: { task: 'Build on macOS 15', from: 'running', to: 'review' } },
  inverse: { kind: 'task.move', args: { task_id: 't1', to: 'running' } }, why_not: null, undoes: null, ref_seq: 9, ...over
})

function line(act: LineAct | null, undo = vi.fn(async (_seq: number): Promise<ActAnswer> => ({ ok: true, seq: 12 })), locale: 'en' | 'ru' = 'en', onUndone = vi.fn()) {
  render(<I18nProvider locale={locale}><ActLine act={act} onUndo={undo} onUndone={onUndone} /></I18nProvider>)
  return { undo, onUndone }
}

describe('the act line', () => {
  it('says what was done and offers «Отменить», wired to acts.undo with the act’s own seq', async () => {
    const { undo, onUndone } = line({ seq: 11, record: record() })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain(actSentence(translator('en'), record()))
    fireEvent.click(screen.getByRole('button', { name: en['act.undo'] }))
    await waitFor(() => expect(undo).toHaveBeenCalledWith(11))
    await waitFor(() => expect(onUndone).toHaveBeenCalledWith({ seq: 11, record: record() }))
    expect(screen.getByText(en['act.undoneNow'])).toBeTruthy()
  })

  it('is not a dialog, an alert or a banner', () => {
    line({ seq: 11, record: record() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a second press while the first runs does not undo twice', async () => {
    let finish!: (v: { ok: true; seq: number }) => void
    const undo = vi.fn(() => new Promise<{ ok: true; seq: number }>((r) => { finish = r }))
    line({ seq: 11, record: record() }, undo)
    const button = screen.getByRole('button', { name: en['act.undo'] })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(undo).toHaveBeenCalledTimes(1)
    finish({ ok: true, seq: 12 })
    await waitFor(() => expect(screen.getByText(en['act.undoneNow'])).toBeTruthy())
  })

  it('a refused undo changes nothing, says why in our words with the machine’s beneath, and can be pressed again', async () => {
    const undo = vi.fn(async (): Promise<ActAnswer> => ({ ok: false, reason: 'held_by_other', says: 'lease held by session 4f2' }))
    line({ seq: 11, record: record() }, undo)
    fireEvent.click(screen.getByRole('button', { name: en['act.undo'] }))
    await waitFor(() => expect(screen.getByText(new RegExp(en['act.why.held_by_other']))).toBeTruthy())
    expect(screen.getByText('lease held by session 4f2')).toBeTruthy()
    expect((screen.getByRole('button', { name: en['act.undo'] }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('an act with no inverse says why it cannot be undone, before any press', () => {
    line({ seq: 11, record: record({ kind: 'task.close', inverse: null, why_not: 'task_closed', said: { key: 'act.task.close', params: { task: 'Ship', outcome: 'done' } } }) })
    expect(screen.queryByRole('button', { name: en['act.undo'] })).toBeNull()
    expect(screen.getByText(new RegExp(en['act.why.task_closed']))).toBeTruthy()
  })

  it('an undo is itself an act: its line says it undid something and can be undone again', () => {
    line({ seq: 12, record: record({ undoes: 11, said: { key: 'act.task.move', params: { task: 'Build on macOS 15', from: 'review', to: 'running' } } }) })
    expect(screen.getByRole('status').textContent).toContain(en['act.undonePrefix'])
    expect(screen.getByRole('button', { name: en['act.undo'] })).toBeTruthy()
  })

  it('shows nothing when there is no act', () => {
    line(null)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('speaks Russian, never a machine id', () => {
    line({ seq: 11, record: record() }, undefined, 'ru')
    const text = screen.getByRole('status').textContent ?? ''
    expect(text).toContain(ru['act.undo'])
    expect(text).toContain('Проверить')
    expect(text).not.toMatch(/\breview\b|task\.move|t1/)
  })
})

describe('the words of an act', () => {
  const t = translator('ru')
  it('names every recorded act kind in both languages', () => {
    const keys = ['act.task.move', 'act.task.close', 'act.claim.release', 'act.claim.take', 'act.repo.detach', 'act.repo.attach',
      'act.project.rename', 'act.project.edit', 'act.question.answer', 'act.question.reopen', 'act.session.stop', 'act.session.start',
      'act.draft.discard', 'act.draft.restore', 'act.release.record', 'act.agent.disconnect', 'act.agent.let_in']
    for (const k of keys) {
      expect(en[k as keyof typeof en], k).toBeTruthy()
      expect(ru[k as keyof typeof ru], k).toBeTruthy()
    }
  })
  it('fills a missing name with a word, never «null»', () => {
    const s = actSentence(t, record({ kind: 'draft.discard', category: 'drafts', said: { key: 'act.draft.discard', params: { draft: null } } }))
    expect(s).not.toContain('null')
  })
  it('words an unknown refusal code without showing the code', () => {
    expect(whyWords(t, 'something_new')).toBe(ru['act.why.other'])
  })
  it('contains no em dash in any act string', () => {
    for (const [k, v] of [...Object.entries(en), ...Object.entries(ru)]) if (k.startsWith('act.') || k.startsWith('rail.') || k.startsWith('create.') || k.startsWith('acts.')) expect(v, k).not.toContain('—')
  })
})

describe('which act the line shows', () => {
  const ev = (seq: number, kind: string, payload: unknown) => ({ estate_id: 'e', seq, type: 'act.recorded@1', actor: { kind, id: 'x' }, project_id: null, occurred_at: '2026-10-18T10:00:00Z', payload: payload as Record<string, unknown> })
  it('is the newest act of the person since they came to this place', () => {
    const feed = [ev(5, 'person', record()), ev(8, 'person', record({ ref_seq: 10 })), ev(9, 'agent', record()), { ...ev(10, 'person', record()), type: 'task.moved@1' }]
    expect(latestPersonAct(feed, 0)?.seq).toBe(8)
    expect(latestPersonAct(feed, 8)).toBeNull()
  })
  it('never shows a payload this product did not write', () => {
    expect(latestPersonAct([ev(5, 'person', { v: 1, kind: 'nonsense' })], 0)).toBeNull()
  })
})
