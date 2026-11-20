// The owner's approval mode (ADR-0203): which acts above the floor wait for the owner, and the rule every session,
// the CEO and its voice are given. Human gates (sign-in, one-time code, payment, typed secret, consent) wait in every mode.
import assert from 'node:assert/strict'
import test from 'node:test'
import { APPROVAL_MODES, DEFAULT_APPROVAL_MODE, approvalModeOf, approvalRule, approvalModeLabel, waitsForOwner, HUMAN_GATES } from '../src/shared/approvalMode.ts'

test('five modes, the default is today\'s floor, and an unknown value is the default, never a looser one', () => {
  assert.deepEqual([...APPROVAL_MODES], ['important', 'critical', 'spending', 'unusual', 'none'])
  assert.equal(DEFAULT_APPROVAL_MODE, 'important')
  assert.equal(approvalModeOf('none'), 'none')
  for (const bad of [undefined, null, 'NONE', 'auto', 42, {}]) assert.equal(approvalModeOf(bad), 'important')
})

test('which floor class waits for the owner in each mode', () => {
  const t = (mode, floor, firstTime = true) => waitsForOwner(mode, floor, { firstTime })
  for (const f of ['money', 'deletion', 'publication']) assert.equal(t('important', f), true, `important: ${f} waits`)
  assert.deepEqual(['money', 'deletion', 'publication'].map((f) => t('critical', f)), [false, true, true])
  assert.deepEqual(['money', 'deletion', 'publication'].map((f) => t('spending', f)), [true, false, false])
  assert.equal(t('unusual', 'deletion', true), true, 'a first act of its kind waits')
  assert.equal(t('unusual', 'deletion', false), false, 'one done before on the same target does not')
  assert.equal(t('unusual', 'money', null), true, 'unknown history is a first time, the safe side')
  for (const f of ['money', 'deletion', 'publication']) assert.equal(t('none', f), false)
  assert.equal(waitsForOwner('none', 'not-a-class', { firstTime: false }), true, 'an unknown class always waits')
})

test('the rule a session reads names the mode and always keeps the human gates', () => {
  for (const m of APPROVAL_MODES) {
    for (const locale of ['ru', 'en']) {
      const r = approvalRule(m, locale)
      assert.ok(r.includes(approvalModeLabel(m, locale)), `${m}/${locale} names its mode`)
      for (const g of HUMAN_GATES[locale]) assert.ok(r.includes(g), `${m}/${locale} keeps «${g}»`)
      assert.ok(!r.includes('—'), 'no em dash in text for people')
    }
  }
  assert.match(approvalRule('none', 'en'), /never stop/i)
  assert.match(approvalRule('important', 'ru'), /доск/)
})
