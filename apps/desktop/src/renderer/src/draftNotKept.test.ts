// 0.3.7 review UX-16: a draft closed but not kept to bring back is said in our words; its reason code is worded, never
// shown bare, and the machine's words travel apart from the sentence (OperatorError's `withDetail`).
import { describe, expect, it } from 'vitest'
import { draftNotKept } from './draftNotKept'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

const tr = (dict: Record<string, string>) => (key: string, params: Record<string, string> = {}) =>
  (dict[key] ?? key).replace(/\{(\w+)\}/g, (_m: string, k: string) => params[k] ?? '')

describe('a draft that could not be kept', () => {
  it('words the refusal code and keeps the machine words apart', () => {
    const [said, detail] = draftNotKept(tr(ru) as never, { reason: 'draft_gone', says: 'ENOENT: no such file' }).split('\u2029') as [string, string]
    expect(said).toBe(String(ru['drafts.notKept']).replace('{reason}', String(ru['act.why.draft_gone'])))
    expect(said).not.toContain('draft_gone')
    expect(detail).toBe('ENOENT: no such file')
  })
  it('an unknown code is a general sentence, never the code', () => {
    const [said] = draftNotKept(tr(en) as never, { reason: 'something_new' }).split('\u2029') as [string, string]
    expect(said).not.toContain('something_new')
    expect(said).toBe(String(en['drafts.notKept']).replace('{reason}', String(en['act.why.other'])))
  })
  it('a failed call says it did not go through, the transport wrapper gone', () => {
    const [said, detail] = draftNotKept(tr(en) as never, Error("Error invoking remote method 'drafts:discard': Error: disk full")).split('\u2029') as [string, string]
    expect(said).toBe(String(en['drafts.notKept']).replace('{reason}', String(en['act.why.failed'])))
    expect(detail).toBe('disk full')
  })
})
