// One append, or none at all (UX28-11).
//
// The settings panel sent two commands for one press of one button, and the
// interesting half of this card is not that they became one — it is WHERE the
// refusal lives. A journal cannot refuse a fact it has already recorded, so the
// compare-and-set must run before the append; an arm that refused an event
// would leave the projection disagreeing with the log it is built from.
//
// So every case below asserts the APPEND COUNT as well as the answer. A command
// that refuses and appends anyway has recorded the thing it said it would not
// do, and no later reader could tell.
//
// THE FAKE IS THE DATABASE, not the store (R-007): `createScopedStore` is the
// real one, so the estate scope is exercised rather than assumed. Fifth module
// of this shape after `digestRead`, `harnessRead`, `memoryOverviewRead` and
// `searchRead`, and the first that writes.
//
// Pure: no database, no network.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CONFIGURED, saveProjectSettings } from '../src/main/commands/projectSettingsCommand.ts'
import { createScopedStore } from '../src/main/scopedStore.ts'
import {
  SETTINGS_FIELDS,
  changedFields,
  conflictOf,
  draftOf,
  isDirty,
  landed,
  validateSettings
} from '../src/shared/projectSettings.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESTATE = 'estate-1'
const BASE = 7

const row = (over = {}) => ({
  id: 'p1',
  estate_id: ESTATE,
  name: 'Atlas',
  purpose: 'keep the ledger',
  repo_path: '/opened/root',
  status: 'active',
  config_revision: BASE,
  created_at: 'x',
  memory_backend: 'local',
  default_agent: 'claude-code',
  mcp_servers: [],
  ...over
})

const draft = (over = {}) => ({
  name: 'Atlas Rebuilt',
  purpose: 'keep the ledger honest',
  defaultAgent: 'claude-code',
  mcpServers: [],
  ...over
})

const input = (over = {}) => ({ id: 'p1', baseRevision: BASE, ...draft(), ...over })

/** A db shaped like PostgREST's, answering each read from a queue and recording
 *  the filters every query used. */
function fakeDb(answers) {
  const queries = []
  const taken = {}
  return {
    queries,
    from: (table) => ({
      select: () => {
        const filters = []
        queries.push({ table, filters })
        const q = {
          eq: (c, v) => { filters.push(['eq', c, String(v)]); return q },
          neq: () => q,
          is: () => q,
          not: () => q,
          or: () => q,
          in: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: () => Promise.resolve(next(table)),
          single: () => Promise.resolve(next(table)),
          then: (resolve) => Promise.resolve(next(table)).then(resolve)
        }
        return q
      }
    })
  }
  function next(table) {
    const list = answers[table]
    if (!list) return { data: null, error: null }
    const i = taken[table] ?? 0
    taken[table] = i + 1
    return list[Math.min(i, list.length - 1)]
  }
}

const one = (data) => ({ data, error: null })
const refused = (message) => ({ data: null, error: { message } })

/** Drive the command with a queue of project reads and a recording append. */
const drive = async (reads, over = {}, appendFails = null) => {
  const db = fakeDb({ projects: reads })
  const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
  const appends = []
  let seq = 41
  const append = async (payload, projectId) => {
    appends.push({ payload, projectId })
    if (appendFails) throw new Error(appendFails)
    return { seq: ++seq }
  }
  const result = await saveProjectSettings({ store, append }, input(over))
  return { result, appends, queries: db.queries }
}

// ── the fields are declared, not scattered ─────────────────────────────────
{
  eq(SETTINGS_FIELDS.length, 4, 'the panel owns four fields, declared as data')
  const stored = row()
  eq(changedFields(draftOf(stored), stored).length, 0, 'a draft taken from a row is not dirty')
  isDirty(draft(), stored)
    ? ok('and a draft with different words is')
    : fail('an edited draft was read as unchanged')
  // A SET, not a list: the panel's checkboxes append in click order.
  changedFields(draft({ mcpServers: ['b', 'a'] }), row({ mcp_servers: ['a', 'b'] })).includes('mcpServers')
    ? fail('reordering the server list was counted as an edit')
    : ok('and reordering the server list is not an edit, because a server list is a set')
}

// ── the happy path is ONE append carrying only what changed ────────────────
{
  const { result, appends } = await drive([one(row()), one(row({ config_revision: 42, name: 'Atlas Rebuilt' }))])
  eq(result.status, 'committed', 'a save on the current revision commits')
  eq(appends.length, 1, 'in exactly ONE append — two were two revisions for one button')
  eq(appends[0].payload.name, 'Atlas Rebuilt', 'carrying the new name')
  eq(result.revision, 42, 'and the revision comes from the append itself, which is what the projector will write')
  // Only what changed. `default_agent` was not edited in this draft.
  'default_agent' in appends[0].payload
    ? fail('an unchanged field reached the payload: ' + JSON.stringify(appends[0].payload))
    : ok('and an unedited field is absent, so the event says what it did rather than restating the row')
  // THE EXCLUSION, structurally: there is no arm and no key for it.
  'repo_path' in appends[0].payload
    ? fail('a settings save carried a repository path, bypassing the opened-root boundary')
    : ok('and no repository path can travel through a settings save (UX28-11 exclusion)')
  eq(landed(result), true, 'and the change is in the journal')
}

// ── a moved base is refused, AND NOTHING IS RECORDED ───────────────────────
{
  const { result, appends } = await drive([one(row({ config_revision: 9, purpose: 'somebody else' }))])
  eq(result.status, 'conflict', 'a save against a stale base is refused')
  eq(appends.length, 0, 'and NOTHING was appended — the refusal is before the journal, not inside it')
  eq(result.currentRevision, 9, 'the answer says what it moved to')
  eq(result.currentValue.purpose, 'somebody else', 'and carries the current row, so the diff needs no second read')
  // SCN-003: "shows the newer diff and asks the operator to reapply the draft".
  const diff = conflictOf(draft(), result.currentValue)
  diff.some((d) => d.field === 'purpose' && d.theirs === 'somebody else')
    ? ok('and the diff names the field, the operator words and the stored ones')
    : fail('the conflict produced no usable diff: ' + JSON.stringify(diff))
}

// ── an invalid draft is refused by the SHARED rule, and records nothing ────
{
  const { result, appends } = await drive([one(row())], { name: '   ' })
  eq(result.status, 'refused', 'an empty name is refused — SCN-028, "an empty name blocks the save"')
  eq(appends.length, 0, 'and nothing was recorded, so the draft is still the only copy')
  eq(result.fields[0], 'name', 'and the refusal names the field, not the save in general')
  // The same rule the panel disables its button with, so they cannot disagree.
  eq(validateSettings({ ...draft(), name: '' }, row()).ok, false, 'the shared rule is the one that refused it')
}

// ── nothing changed is not a revision ──────────────────────────────────────
{
  const stored = row()
  const { result, appends } = await drive([one(stored)], draftOf(stored))
  eq(result.status, 'refused', 'a save that changes nothing is refused rather than recorded')
  eq(appends.length, 0, 'and appends nothing: an empty revision is a fact about nobody')
}

// ── the append landed and the read-back did not ────────────────────────────
{
  const { result, appends } = await drive([one(row()), refused('connection lost')])
  eq(appends.length, 1, 'the append happened')
  eq(result.status, 'written', 'and a failed read-back is NOT reported as a failure')
  eq(result.revision, 42, 'the recorded revision is still known, because the append returned it')
  eq(landed(result), true, 'and the change counts as landed, because it is in the journal')
  // THE DEFECT THIS ARM EXISTS FOR, in the words the cycle keeps using: a
  // refused read must not turn a recorded fact into nothing at all.
  result.status === 'failed' ? fail('a committed revision was reported as nothing saved') : ok('nothing claims it did not happen')
}

// ── the read BEFORE the append failing records nothing, and says so ────────
{
  const { result, appends } = await drive([refused('connection lost')])
  eq(result.status, 'failed', 'a project that cannot be read fails the save')
  eq(appends.length, 0, 'and appends nothing, which is what makes "nothing was saved" a fact')
  eq(landed(result), false, 'and it did not land')
  // THE REASON, and this assertion exists because a plant proved the status was
  // not enough. Removing the read-error guard left every case above green: a
  // refused read has `data: null`, so the missing-project guard below already
  // answers `failed` with zero appends. What it answers WITH is the difference —
  // "that project is not in this estate" for a connection failure is a false
  // explanation, and a false reason sends the operator to fix the wrong thing.
  const explained = /could not be read|read failed/.test(result.reason)
  explained
    ? ok('and says the READ failed rather than blaming the project for not existing')
    : fail('a refused read was explained as a missing project: ' + JSON.stringify(result.reason))
}

// ── a project outside this estate is not found, not overwritten ────────────
{
  const { result, appends } = await drive([one(null)])
  eq(result.status, 'failed', 'a project the scope cannot see is not saved to')
  eq(appends.length, 0, 'and nothing was recorded for it')
}

// ── the scope comes from the store, once ───────────────────────────────────
{
  const { queries } = await drive([one(row()), one(row({ config_revision: 42 }))])
  const missing = queries.filter((q) => !q.filters.some(([op, col]) => op === 'eq' && col === 'estate_id'))
  missing.length === 0
    ? ok(`both project reads carry the estate filter, and the module writes neither`)
    : fail(`${missing.length} query(ies) carry no estate filter`)
  const source = readFileSync(
    path.join(import.meta.dirname, '../src/main/commands/projectSettingsCommand.ts'),
    'utf8'
  )
  !/estate_id/.test(source.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|--)/.test(l)).join('\n'))
    ? ok('and names `estate_id` nowhere in its code: the scope is applied in one place (searchRead’s lesson)')
    : fail('the command writes its own estate filter, duplicating what the store already applies')
  eq(CONFIGURED, 'project.configured@1', 'and the event type is the one the migration registered')
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: one append or none, the refusal sits before the journal, and a landed save is never reported as nothing')
