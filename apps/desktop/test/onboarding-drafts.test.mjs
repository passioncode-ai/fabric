// The store that keeps a half-described project (AX-05).
//
// A plant is why this file exists. Removing `worthKeeping` from the save left
// every probe green: the pure filter had cases of its own, and NOTHING drove
// the module that calls it — `localStore` reaches for Electron's `app.getPath`,
// so a node probe could not load it. AX-02's card names that substitution in
// its own exclusions: "do not count pure helper tests as caller coverage."
//
// The store is injected here. What is asserted is the module's two decisions:
// what reaches the disk, and what the three read statuses mean.
//
// Pure: no Electron, no filesystem.

import { createDrafts } from '../src/main/onboardingDrafts.ts'
import { mayPersist } from '../src/shared/onboardingDraft.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const draft = (over = {}) => ({
  projectId: 'p-1', name: '', purpose: '', repoPaths: [], memory: 'local', agent: 'claude-code', ...over
})

/** A store that records what it was asked to write, and the module over it. */
function fake(current = {}, write = { status: 'committed' }, status = 'ready', error = undefined) {
  const wrote = []
  const drafts = createDrafts({
    read: () => ({ value: current, revision: 'r1', status, lastGoodAt: null, error }),
    update: (change) => {
      wrote.push(change(current))
      return { ...write, value: wrote[wrote.length - 1], revision: 'r2' }
    }
  })
  return { wrote, drafts }
}

// ── only started drafts reach the disk ─────────────────────────────────────
{
  const { wrote, drafts } = fake()
  drafts.save({
    'tab-1': draft({ name: 'Atlas' }),
    'tab-2': draft()
  })
  eq(wrote.length, 1, 'the save wrote once')
  eq(Object.keys(wrote[0]).join(','), 'tab-1', 'and only the draft somebody typed into reached the disk')
  // THE POINT. An untouched tab that reached the file would be restored as
  // work nobody did, which is the false claim `tabs.ts` refused to make for
  // years — from the other direction.
  'tab-2' in wrote[0]
    ? fail('an untouched form was persisted, so a tab nobody typed into would come back')
    : ok('so an untouched form leaves no trace and cannot be restored as work')
}

// ── the write result is passed on, not swallowed ───────────────────────────
{
  const { drafts } = fake({}, { status: 'conflict', currentRevision: 'r9', currentValue: {} })
  const answer = drafts.save({ 'tab-1': draft({ name: 'Atlas' }) })
  eq(answer.status, 'conflict', 'a conflict is returned as a conflict')
  answer.status === 'committed'
    ? fail('a conflict was reported as a save')
    : ok('and never as a save — a draft the operator believes is safe is worse than one they know is not')
}

// ── the three read statuses keep their meanings ────────────────────────────
{
  for (const [status, persistable] of [['ready', true], ['recovered', true], ['unreadable', false]]) {
    eq(
      mayPersist(status),
      persistable,
      `\`${status}\` ${persistable ? 'may' : 'may NOT'} be written back`
    )
  }
  // `recovered` is the interesting one: the file would not parse, an earlier
  // good copy was used, and writing it back REPAIRS the file. Treating it like
  // `unreadable` would leave a broken file broken forever.
  const recovered = fake({ 'tab-1': draft({ name: 'Atlas' }) }, { status: 'committed' }, 'recovered', 'bad json')
  eq(recovered.drafts.read().status, 'recovered', 'a recovered read says so rather than passing as ready')
  eq(recovered.drafts.read().drafts['tab-1'].name, 'Atlas', 'and its value is the earlier good copy, not a default')
  const unreadable = fake({}, { status: 'committed' }, 'missing', 'ENOENT')
  eq(unreadable.drafts.read().status, 'unreadable', 'and anything else is unreadable, whatever localState called it')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: only started drafts reach the disk, a conflict is never a save, and a recovered read is usable')
