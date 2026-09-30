// The workspace mirror against the real store (M118, ADR-0002).
//
// `mirror.test.ts` proves the rules — deterministic, field-named, correctly
// quoted — against fixtures. What a fixture cannot prove is that `readEstate`
// maps the right COLUMNS: it renames `role` to `name` and `provider_ref` to
// `runner_id` by hand, and a wrong mapping produces a mirror that is beautifully
// deterministic and describes the wrong estate.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { checkGenerationOnDisk, checkWorkspace, importWorkspace, previewImport, readEstate, writeWorkspace } from ${JSON.stringify(path.join(HERE, '../src/main/workspace.ts'))}
import { createScopedStore } from ${JSON.stringify(path.join(HERE, '../src/main/scopedStore.ts'))}
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
// S02.a: the mirror writes ONE estate, and this probe now SEEDS the one it
// reads. It used to read whatever the database happened to hold and assert that
// the count was above zero — which passed because the read was unscoped and
// found three other estates' fixtures. Measured on a freshly reset database:
// org #1, the operator's own estate, held zero projects while the mirror wrote
// seventeen. The probe was satisfied by the defect it should have caught.
//
// Its own estate rather than org #1, for the reason the context-pack probe
// states: a suite that seeds the operator's estate leaves its fixtures on the
// real home screen, recreated on every run.
const ESTATE = randomUUID()
const ACTOR = { kind: 'system', id: 'workspace-probe' }
const journal = createJournal(db)
const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })

await journal.append({ estateId: ESTATE, type: 'estate.created@1', actor: ACTOR, payload: { name: 'mirror probe' } })
const seeded = randomUUID()
await journal.append({
  estateId: ESTATE, type: 'project.created@1', actor: ACTOR, projectId: seeded,
  payload: { id: seeded, name: 'mirrored', purpose: 'the mirror reads this one' }
})

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const estate = await readEstate(store)
// Exactly what was seeded, and nothing else: the count is now an assertion about
// the boundary rather than about how much other suites left lying around.
estate.projects.length === 1 && estate.projects[0].id === seeded
  ? ok('the declared layer reads its own estate out of the store, and only that')
  : fail('read ' + estate.projects.length + ' projects: ' + JSON.stringify(estate.projects.map((p) => p.id)))

// Every project must carry the fields the mirror names. A column renamed under
// the mapping shows up here as a row of nulls rather than as a crash.
const bad = estate.projects.filter((p) => !p.id || !p.name || !p.status || !p.default_agent)
bad.length === 0
  ? ok('and every project carries the fields the mirror names, not a row of nulls')
  : fail(bad.length + ' project(s) missing mapped fields, first: ' + JSON.stringify(bad[0]))

const root = mkdtempSync(path.join(tmpdir(), 'fabric-workspace-'))
const written = await writeWorkspace(root, store)
written && written.length === 3 && written[written.length - 1] === 'workspace/manifest.json'
  ? ok('writing the workspace produces its two declared files and the manifest LAST, as the generation marker')
  : fail('wrote: ' + JSON.stringify(written))

const again = await writeWorkspace(root, store)
again && again.length === 0
  ? ok('and writing it twice changes nothing — an unchanged estate is not a diff')
  : fail('the second write touched: ' + JSON.stringify(again))

const clean = await checkWorkspace(root, store)
clean.length === 0
  ? ok('what was written agrees with the estate it was written from')
  : fail('divergence right after writing: ' + JSON.stringify(clean))

// A hand edit is a divergence, and the report says the FILE is out of date.
writeFileSync(path.join(root, 'workspace/projects.yaml'), 'projects: []\\n')
const dirty = await checkWorkspace(root, store)
dirty.length === 1 && dirty[0].reason.includes('the estate is the store')
  ? ok('a hand edit is reported as the file being out of date, not the estate')
  : fail('hand edit produced: ' + JSON.stringify(dirty))

// No workspace is a supported answer and not a failure.
const none = await writeWorkspace(null, store)
none === null ? ok('declining a workspace writes nothing and reports nothing wrong')
  : fail('a null root wrote: ' + JSON.stringify(none))

// Importing into an estate that already holds projects is REFUSED. Merging two
// estates is a thing nobody specified, and doing it by inserting what is missing
// answers every hard question about it by accident.
//
// S12 — the check now runs INSIDE the transaction that would do the writing,
// under a lock on the estate. In the client it ran minutes before the first
// append, so two imports started together both saw an empty estate and both
// proceeded. The probe therefore lets the real commit run and reads what the
// DATABASE said.
const before = await db.from('journal').select('seq', { count: 'exact', head: true }).eq('estate_id', ESTATE)
const refused = await importWorkspace(root, store, async (input) => {
  const { error } = await db.rpc('import_declared_snapshot', {
    p_estate_id: ESTATE, p_command_id: input.commandId, p_input_digest: input.inputDigest,
    p_actor: { kind: 'person', id: 'probe' }, p_events: input.events
  })
  return error ? { ok: false, reason: error.message } : { ok: true }
})
refused.ok === false && refused.reason.includes('already holds projects')
  ? ok('importing into a non-empty estate is refused, by the lock rather than by a stale client check')
  : fail('import into a populated estate returned: ' + JSON.stringify(refused))

const after = await db.from('journal').select('seq', { count: 'exact', head: true }).eq('estate_id', ESTATE)
after.count === before.count
  ? ok('and NOTHING was appended — the whole import is one transaction or it is nothing')
  : fail('a refused import appended ' + (after.count - before.count) + ' event(s)')

// The plan, before anything is written. This is what an operator sees.
const plan = previewImport(root)
plan.says.includes('goals') && plan.says.includes('will not bring those back')
  ? ok('the preview says what the import will NOT bring back, in the operator words')
  : fail('the plan hides its coverage: ' + JSON.stringify(plan.says))

plan.coverage.length >= 25 && plan.coverage.filter((c) => c.mode === 'complete').length === 2
  ? ok('and it accounts for every table the estate has — two carried, the rest excused by name')
  : fail('coverage covers ' + plan.coverage.length + ' entities')

// The generation marker: written LAST, and it is what tells an interrupted
// write apart from an operator editing a file.
const gen = checkGenerationOnDisk(root)
gen.status === 'diverged' && gen.drifted.includes('workspace/projects.yaml')
  ? ok('a hand-edited file is DIVERGED from the last generation Fabric wrote')
  : fail('generation check said ' + JSON.stringify(gen))

writeFileSync(path.join(root, 'workspace/manifest.json'), '{ not json')
checkGenerationOnDisk(root).status === 'unknown'
  ? ok('and a manifest that will not parse answers UNKNOWN, never current')
  : fail('an unreadable manifest was read as a generation')

if (failures > 0) { console.log('\\n' + failures + ' workspace failure(s)'); process.exit(1) }
`

const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', cwd: path.resolve(HERE, '../../..') })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') env.SUPABASE_URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') env.SUPABASE_SERVICE_ROLE_KEY = m[2]
  }
} catch {
  console.log('  FAIL the local stack is not running — this probe asserts nothing without it (no skip, M110).')
  process.exit(1)
}
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
