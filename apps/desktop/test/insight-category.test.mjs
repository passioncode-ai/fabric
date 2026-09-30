// The correction's outcome, probed by ATTEMPTING the refusal (M182, R-003).
//
// The defect this file exists for is a FALSEHOOD, not an absence: the projector
// refused an agent's attempt to bury a person's fact with a WHERE clause, a
// WHERE clause that matches nothing raises nothing, and the tool then returned
// the id it had been asked to supersede as though it had. So the probe cannot
// read the tool's answer — it has to reach the projector, attempt each refusal,
// and read what the ROW says happened.
//
// What it must prove:
//   1. every older fact replays to category=project, about null, no occurrence
//      and `not_requested` — nothing inferred from a basename or a model
//   2. an agent may not bury a person's fact: the claim is written, the
//      person's fact still answers, and the outcome SAYS conflict_proposed
//   3. a person may supersede an agent, and that says superseded
//   4. correcting an already-corrected fact is a conflict, not a second burial
//   5. naming a fact that is not there is rejected, with a reason
//   6. three facts about one episode are ONE occurrence; three episodes are three
//   7. an agent's own grouping is provisional; a person's is reviewed
//   8. the closed category refuses an unknown value AT THE DATABASE
//   9. a fact id is not a mutable slot — a second event may not rewrite a claim

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const ESTATE = randomUUID()
const AGENT = { kind: 'agent', id: 'insight-probe' }
const PERSON = { kind: 'person', id: 'operator-probe' }
const projectId = randomUUID()

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

await journal.append({ estateId: ESTATE, type: 'project.created@1',
  actor: { kind: 'system', id: 'probe' }, projectId,
  payload: { id: projectId, name: 'insight probe' } })

const remember = async (actor, payload) => {
  const id = payload.id ?? randomUUID()
  const e = await journal.append({ estateId: ESTATE, type: 'memory.project.recorded@1',
    actor, projectId, payload: { ...payload, id } })
  return { id, seq: e.seq }
}
const factOf = async (id) => {
  const { data } = await db.from('memory_facts')
    .select('claim,category,about_namespace,about_key,occurrence_id,valid_to,superseded_by,supersedes_requested,correction_outcome,correction_reason')
    .eq('id', id).single()
  return data
}

// ── 1. the legacy shape, replayed exactly as it was written ──────────────────
//
// The payload an older event carried: no category, no about, no occurrence.
const legacy = await remember(AGENT, { claim: 'the build needs pnpm 9', source_ref: 'README#L4' })
const legacyRow = await factOf(legacy.id)
legacyRow?.category === 'project'
  && legacyRow.about_namespace === null
  && legacyRow.occurrence_id === null
  && legacyRow.correction_outcome === 'not_requested'
  ? ok('an event with none of the new fields replays to category=project, about null, no occurrence, no correction')
  : fail('legacy replay: ' + JSON.stringify(legacyRow))

// And nothing was invented from the source ref.
legacyRow?.about_key === null
  ? ok('nothing was inferred from the source ref — a basename is not a subject')
  : fail('about_key was invented: ' + legacyRow?.about_key)

// ── 2. an agent may not bury what a person recorded ──────────────────────────
const humanFact = await remember(PERSON, { claim: 'we target postgres 17', category: 'project' })
const agentBurial = await remember(AGENT, {
  claim: 'we target postgres 16', category: 'project', supersedes: humanFact.id
})
const buried = await factOf(humanFact.id)
const burialRow = await factOf(agentBurial.id)
buried?.valid_to === null
  ? ok("the person's fact still answers searches — the burial was refused")
  : fail("the person's fact was closed: " + JSON.stringify(buried))
burialRow?.correction_outcome === 'conflict_proposed' && burialRow.correction_reason
  ? ok('and the ROW says conflict_proposed with a reason, where the tool used to echo the request')
  : fail('outcome not recorded: ' + JSON.stringify(burialRow))
burialRow?.supersedes_requested === humanFact.id
  ? ok('what was ASKED is kept beside what happened, so the writer can say what it tried')
  : fail('the request was not kept: ' + JSON.stringify(burialRow))
burialRow?.claim === 'we target postgres 16'
  ? ok("and the agent's own claim IS written — both stand and a person decides")
  : fail('the claim was dropped: ' + JSON.stringify(burialRow))

// ── 3. a person may supersede an agent ───────────────────────────────────────
const agentFact = await remember(AGENT, { claim: 'the cache lives in /tmp' })
const humanFix = await remember(PERSON, {
  claim: 'the cache lives under the app support dir', supersedes: agentFact.id
})
const closedByPerson = await factOf(agentFact.id)
const fixRow = await factOf(humanFix.id)
closedByPerson?.valid_to !== null && closedByPerson.superseded_by === humanFix.id
  ? ok('a person supersedes an agent: the window closes and names its successor')
  : fail('person supersede failed: ' + JSON.stringify(closedByPerson))
fixRow?.correction_outcome === 'superseded' && fixRow.correction_reason === null
  ? ok('and the outcome is superseded, with no reason needed')
  : fail('outcome wrong: ' + JSON.stringify(fixRow))

// ── 4. correcting something already corrected ────────────────────────────────
const second = await remember(PERSON, {
  claim: 'the cache lives somewhere else again', supersedes: agentFact.id
})
const secondRow = await factOf(second.id)
const stillFirst = await factOf(agentFact.id)
secondRow?.correction_outcome === 'conflict_proposed'
  ? ok('a fact already corrected is not corrected twice — the second is a conflict')
  : fail('double burial: ' + JSON.stringify(secondRow))
stillFirst?.superseded_by === humanFix.id
  ? ok('and the FIRST correction still owns the lineage; the second did not overwrite it')
  : fail('lineage overwritten: ' + JSON.stringify(stillFirst))

// ── 4b. and the outcome SURVIVES ITS OWN REPLAY ──────────────────────────────
//
// Projections are rebuilt by replaying the journal OVER the existing rows
// rather than into an empty table (\`rebuild_estate_projections\`), so every arm
// has to be idempotent. Written as a bare \`valid_to is not null\`, the conflict
// branch read the state its own previous application had produced: the first
// pass corrected, the rebuild saw a closed target and demoted itself to a
// conflict. No unit test can see that — the defect only exists on the second
// application, which is why this assertion replays.
const replay = await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
// R-004: a verification that does not REACH its subject proves nothing about
// the product. This assertion is the whole point of the replay below, and a
// silently refused RPC would have made every line under it pass for free.
replay.error === null
  ? ok('the rebuild RPC ran — the replay assertions below reach their subject')
  : fail('the rebuild RPC did not run: ' + JSON.stringify(replay.error))
const afterReplay = await factOf(humanFix.id)
const targetAfterReplay = await factOf(agentFact.id)
afterReplay?.correction_outcome === 'superseded'
  ? ok('and a rebuild leaves the correction superseded — the outcome survives its own replay')
  : fail('replay demoted the correction: ' + JSON.stringify(afterReplay))
targetAfterReplay?.superseded_by === humanFix.id && targetAfterReplay.valid_to !== null
  ? ok('and the lineage is unchanged by the rebuild')
  : fail('replay moved the lineage: ' + JSON.stringify(targetAfterReplay))
const secondAfterReplay = await factOf(second.id)
secondAfterReplay?.correction_outcome === 'conflict_proposed'
  ? ok('while the genuine conflict is STILL a conflict after the rebuild, not promoted')
  : fail('replay promoted a conflict: ' + JSON.stringify(secondAfterReplay))

// ── 5. correcting nothing ────────────────────────────────────────────────────
const ghost = await remember(PERSON, { claim: 'correcting a fact that is not here', supersedes: randomUUID() })
const ghostRow = await factOf(ghost.id)
ghostRow?.correction_outcome === 'rejected' && /no such fact/i.test(ghostRow.correction_reason ?? '')
  ? ok('naming a fact that is not in this project is rejected, and says so')
  : fail('ghost correction: ' + JSON.stringify(ghostRow))

// ── 6. an occurrence is an incident, not a mention ───────────────────────────
const episode = { system: 'fabric.session', source_id: 'sess-1', episode_key: 'crash-a' }
const three = []
for (const n of [1, 2, 3])
  three.push(await remember(AGENT, {
    claim: 'the runner died mid-write, report ' + n,
    kind: 'trap', category: 'agents',
    about: { namespace: 'provider', key: 'the-runner' },
    occurrence: episode
  }))
const rows = await Promise.all(three.map((f) => factOf(f.id)))
const occurrences = new Set(rows.map((r) => r?.occurrence_id))
occurrences.size === 1 && !occurrences.has(null)
  ? ok('three facts about one episode carry ONE occurrence, not three')
  : fail('occurrence identity: ' + JSON.stringify([...occurrences]))

const distinct = []
for (const key of ['crash-a', 'crash-b', 'crash-c'])
  distinct.push(await remember(AGENT, {
    claim: 'the runner died again, episode ' + key,
    kind: 'trap', category: 'agents',
    occurrence: { ...episode, episode_key: key }
  }))
const distinctRows = await Promise.all(distinct.map((f) => factOf(f.id)))
new Set(distinctRows.map((r) => r?.occurrence_id)).size === 3
  ? ok('three genuinely different episodes stay three occurrences')
  : fail('episodes merged: ' + JSON.stringify(distinctRows.map((r) => r?.occurrence_id)))

// ── 7. who established distinctness ──────────────────────────────────────────
const { data: agentEpisode } = await db.from('memory_occurrences')
  .select('grouping').eq('estate_id', ESTATE).eq('project_id', projectId)
  .eq('episode_key', 'crash-b').single()
agentEpisode?.grouping === 'agent_proposed'
  ? ok("an agent's own grouping is recorded as PROVISIONAL, whatever it claims")
  : fail('agent grouping: ' + JSON.stringify(agentEpisode))

await remember(PERSON, {
  claim: 'I watched this happen', occurrence: { ...episode, episode_key: 'crash-b' }
})
const { data: promoted } = await db.from('memory_occurrences')
  .select('grouping').eq('estate_id', ESTATE).eq('project_id', projectId)
  .eq('episode_key', 'crash-b').single()
promoted?.grouping === 'reviewed'
  ? ok('and a person citing the same episode PROMOTES it')
  : fail('promotion: ' + JSON.stringify(promoted))

// PROMOTION ONLY, and this is the assertion that reaches it. The order above is
// agent-then-person, which moves UPWARD under a naive \`grouping =
// excluded.grouping\` too — so it cannot tell the guard from its absence. The
// case the CASE expression exists for is an agent citing an episode a person
// has already reviewed: a demotion would hand an agent the ability to reset any
// episode's standing to provisional by mentioning it.
await remember(AGENT, {
  claim: 'mentioning the reviewed episode again', occurrence: { ...episode, episode_key: 'crash-b' }
})
const { data: notDemoted } = await db.from('memory_occurrences')
  .select('grouping').eq('estate_id', ESTATE).eq('project_id', projectId)
  .eq('episode_key', 'crash-b').single()
notDemoted?.grouping === 'reviewed'
  ? ok('and an agent mentioning a reviewed episode does NOT reset it to provisional')
  : fail('an agent demoted a reviewed episode: ' + JSON.stringify(notDemoted))

// ── 8. the closed category, ATTEMPTED ────────────────────────────────────────
//
// Through the projector, with every client-side check bypassed: the DTO's enum
// is a convention until the column refuses.
let refusedCategory = null
try {
  await remember(AGENT, { claim: 'a lesson in a category nobody defined', category: 'Fabric' })
} catch (e) { refusedCategory = String(e) }
refusedCategory && /category/i.test(refusedCategory)
  ? ok('an unknown category is refused BY THE DATABASE, with the tool bypassed')
  : fail('an unknown category was accepted: ' + refusedCategory)

let refusedNamespace = null
try {
  await remember(AGENT, { claim: 'about a file', about: { namespace: 'file', key: 'index.ts' } })
} catch (e) { refusedNamespace = String(e) }
refusedNamespace
  ? ok('and an about-namespace outside the closed set is refused the same way')
  : fail('a free-text namespace was accepted')

// ── 9. a fact id is not a mutable slot ───────────────────────────────────────
//
// The upsert exists so a REPLAY is idempotent. A different event carrying the
// same id is a rewrite of history using that idempotency as the tool.
const reused = await remember(AGENT, { claim: 'the first thing I believed' })
await remember(AGENT, { id: reused.id, claim: 'a different thing, same id', category: 'fabric' })
const afterRewrite = await factOf(reused.id)
afterRewrite?.claim === 'the first thing I believed' && afterRewrite.category === 'project'
  ? ok('a second event does not rewrite the claim under a fact id the first event owns')
  : fail('the claim was rewritten with no correction and no lineage: ' + JSON.stringify(afterRewrite))

// AND THE ESTATE IS STILL REBUILDABLE WITH THAT PAIR IN THE JOURNAL. This is
// the reason the rule is an ownership check rather than a raise: a raise inside
// a projector arm does not refuse one write, it makes "rebuild_estate_projections"
// fail for the whole estate as long as the pair is there — and ADR-0014 rests
// on that rebuild.
const replayWithPair = await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
const afterPairReplay = await factOf(reused.id)
replayWithPair.error === null && afterPairReplay?.claim === 'the first thing I believed'
  ? ok('and the estate still rebuilds with that pair in the journal, keeping the first claim')
  : fail('the pair made the estate unrebuildable: ' + JSON.stringify(replayWithPair.error))

// And the honest inverse: the SAME event applied twice changes nothing.
const idempotent = await factOf(legacy.id)
idempotent?.claim === 'the build needs pnpm 9'
  ? ok('while a replay of the same event is still idempotent — the upsert keeps its reason')
  : fail('replay broke: ' + JSON.stringify(idempotent))

// ── how much was actually asserted ───────────────────────────────────────────
const { count } = await db.from('memory_facts')
  .select('id', { count: 'exact', head: true }).eq('project_id', projectId)
console.log('  ok   ' + count + ' facts written by this probe, across ' +
  (await db.from('memory_occurrences').select('occurrence_id', { count: 'exact', head: true })
     .eq('project_id', projectId)).count + ' occurrences')

if (failures > 0) { console.log('\\n' + failures + ' insight-category failure(s)'); process.exit(1) }
`

const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
    cwd: path.resolve(HERE, '../../..')
  })
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
  const out = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') }
  )
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
