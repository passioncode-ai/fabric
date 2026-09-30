// The membership boundary, probed by ATTEMPTING what it forbids (S09, R-003).
//
// The defect this exists for is a way to lose an estate permanently, and it is
// reachable by the product itself: `memberships` has held the role since
// migration one, nothing protected the last owner, and the application connects
// as the service role. Delete it and the data is intact and unreachable —
// nobody can grant a membership, and every policy keys off one.
//
// So this cannot read a return value and be satisfied. Every refusal is reached
// by attempting the write DIRECTLY, from the role the product actually uses,
// with the command bypassed.
//
// What it must prove:
//   1. the last owner cannot be revoked, by the command OR by direct SQL
//   2. a transfer works when the new owner is added FIRST, in one transaction
//   3. two concurrent revokes of two owners cannot both succeed
//   4. the revision moves on every change and is not the caller's to set
//   5. a stale expected revision is a CONFLICT, and nothing is written
//   6. the same command_id returns the same receipt, not a second membership
//   7. revoking a membership that is not there says the same thing as one in an
//      estate the caller may not read — no object disclosure

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const estate = randomUUID()
const alice = randomUUID()
const bob = randomUUID()
const carol = randomUUID()
const dave = randomUUID()

// A fixture estate of its own, so nothing here can lock out the estate the rest
// of the suite uses.
await db.from('estates').insert({ id: estate, name: 'membership probe' })
for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob'], [carol, 'Carol'], [dave, 'Dave']])
  await db.from('persons').insert({ id, display_name: name })
await db.from('memberships').insert({ person_id: alice, estate_id: estate, role: 'owner' })

const change = (over) =>
  db.rpc('change_membership', {
    p_command_id: randomUUID(),
    p_estate_id: estate,
    p_target_person: bob,
    p_role: 'member',
    p_action: 'grant',
    p_expected_revision: null,
    p_changed_by: 'probe',
    ...over
  })

const owners = async () => {
  const { count } = await db.from('memberships')
    .select('person_id', { count: 'exact', head: true })
    .eq('estate_id', estate).eq('role', 'owner')
  return count
}

// ── 1. the last owner, attempted through the command AND directly ────────────
{
  const viaCommand = await change({ p_target_person: alice, p_action: 'revoke', p_role: null })
  const after = await owners()
  viaCommand.error && /no owner/i.test(viaCommand.error.message)
    ? ok('the command refuses to revoke the last owner, and says what it would cost')
    : fail('the command removed the last owner: ' + JSON.stringify(viaCommand.data ?? viaCommand.error))
  after === 1 ? ok('and the owner is still there') : fail('owners after the attempt: ' + after)

  // THE SAME ATTEMPT, WITH THE COMMAND BYPASSED. A check inside the command is
  // a rule that holds until somebody writes the table another way, and the
  // service role can — which is the role the product itself uses.
  const direct = await db.from('memberships').delete()
    .eq('estate_id', estate).eq('person_id', alice)
  direct.error && /no owner/i.test(direct.error.message)
    ? ok('and a DIRECT delete as service_role is refused too — the floor is a trigger, not a convention')
    : fail('a direct delete removed the last owner: ' + JSON.stringify(direct.error))
  ;(await owners()) === 1
    ? ok('and the estate still has its owner after the direct attempt')
    : fail('the direct attempt left ' + (await owners()) + ' owner(s)')

  // A role CHANGE that empties the owners is the same loss by another route.
  const demote = await db.from('memberships').update({ role: 'member' })
    .eq('estate_id', estate).eq('person_id', alice)
  demote.error
    ? ok('and demoting the last owner is refused as well — the same loss by another route')
    : fail('the last owner was demoted to member, which empties the estate of owners')
}

// ── 2. a transfer, added first, in one transaction ───────────────────────────
{
  const grant = await change({ p_target_person: bob, p_role: 'owner', p_action: 'grant' })
  grant.data?.status === 'committed'
    ? ok('a second owner can be granted')
    : fail('grant failed: ' + JSON.stringify(grant.data ?? grant.error))
  const revoke = await change({ p_target_person: alice, p_action: 'revoke', p_role: null })
  revoke.data?.status === 'committed' && (await owners()) === 1
    ? ok('and THEN the first owner can go: a transfer is one owner added before the other leaves')
    : fail('transfer failed: ' + JSON.stringify(revoke.data ?? revoke.error))
}

// ── 3. two concurrent revokes of two owners ──────────────────────────────────
{
  await change({ p_target_person: carol, p_role: 'owner', p_action: 'grant' })
  ;(await owners()) === 2 ? ok('two owners, for the concurrency case') : fail('owners: ' + (await owners()))

  // Fired together. Whichever lands second must see the world the first left.
  const [a, b] = await Promise.all([
    change({ p_target_person: bob, p_action: 'revoke', p_role: null }),
    change({ p_target_person: carol, p_action: 'revoke', p_role: null })
  ])
  const committed = [a, b].filter((r) => r.data?.status === 'committed').length
  const left = await owners()
  committed === 1 && left === 1
    ? ok('two concurrent revokes of two owners: exactly one commits, and an owner remains')
    : fail(\`both revokes were accepted: committed=\${committed}, owners=\${left}\`)
}

// ── 4. the revision moves, and is not the caller's to set ────────────────────
{
  const target = (await db.from('memberships').select('person_id,revision,role')
    .eq('estate_id', estate).eq('role', 'owner').single()).data
  const before = target.revision
  await db.from('memberships').update({ role: 'owner', revision: 999 })
    .eq('estate_id', estate).eq('person_id', target.person_id)
  const after = (await db.from('memberships').select('revision')
    .eq('estate_id', estate).eq('person_id', target.person_id).single()).data
  after.revision === before + 1
    ? ok('the revision moves by one on every change, and a caller naming 999 does not get it')
    : fail(\`revision went \${before} -> \${after.revision}\`)
}

// ── 5. a stale expected revision is a conflict, and writes nothing ───────────
{
  // DAVE, not whoever survived the race above. The first version of this used
  // the person left over from the concurrency case, who by then was the estate's
  // only owner — so the setup grant tried to demote the last owner, the trigger
  // correctly refused it, and the assertion below was measuring a role that had
  // never been set. The plant looked like a product defect and was a fixture
  // that never reached its subject.
  const setup = await change({ p_target_person: dave, p_role: 'member', p_action: 'grant' })
  setup.data?.status === 'committed'
    ? ok('a third person is a member, independently of who survived the race above')
    : fail('the setup grant did not commit: ' + JSON.stringify(setup.data ?? setup.error))
  const current = (await db.from('memberships').select('revision')
    .eq('estate_id', estate).eq('person_id', dave).single()).data.revision
  const conflict = await change({
    p_target_person: dave, p_role: 'owner', p_action: 'grant',
    p_expected_revision: current - 1
  })
  const role = (await db.from('memberships').select('role')
    .eq('estate_id', estate).eq('person_id', dave).single()).data.role
  conflict.data?.status === 'conflict' && conflict.data.reason_code === 'revision_moved'
    ? ok('a decision made on a reading that has moved is a CONFLICT, with both numbers named')
    : fail('stale revision accepted: ' + JSON.stringify(conflict.data ?? conflict.error))
  role === 'member'
    ? ok('and nothing was written — the caller retries with a fresh reading')
    : fail('the conflicted command still changed the role to ' + role)
}

// ── 5b. a GRANT that empties the owners is refused too ───────────────────────
//
// Found by the fixture above going wrong: demoting somebody is a "grant" of a
// lesser role, so the last-owner floor has to hold on the grant path as well —
// and it does, which is why that setup silently did nothing.
{
  const lastOwner = (await db.from('memberships').select('person_id')
    .eq('estate_id', estate).eq('role', 'owner').single()).data.person_id
  const demote = await change({ p_target_person: lastOwner, p_role: 'member', p_action: 'grant' })
  const still = (await db.from('memberships').select('role')
    .eq('estate_id', estate).eq('person_id', lastOwner).single()).data.role
  demote.error && still === 'owner'
    ? ok('granting a LESSER role to the last owner is refused — a demotion is the same loss as a delete')
    : fail('the last owner was demoted through the grant path: ' + JSON.stringify(demote.data ?? demote.error))
}

// ── 6. the same command twice ────────────────────────────────────────────────
{
  // ITS OWN PERSON. This used to reuse Carol, whose role at this point depends
  // on which side of the concurrent-revoke race above happened to commit — so
  // when the race left her the last owner, granting her the member role demoted
  // the estate's only owner and the floor refused, and the case reported the
  // retry as broken. That is the cause of CO-125, established 2026-09-10 after the
  // probe was taught to read the error it had been swallowing: a red that
  // appeared once, passed alone, and depended on a coin toss.
  const erin = randomUUID()
  await db.from('persons').insert({ id: erin, display_name: 'Erin' })
  const id = randomUUID()
  const first = await db.rpc('change_membership', {
    p_command_id: id, p_estate_id: estate, p_target_person: erin,
    p_role: 'member', p_action: 'grant', p_expected_revision: null, p_changed_by: 'probe'
  })
  const second = await db.rpc('change_membership', {
    p_command_id: id, p_estate_id: estate, p_target_person: erin,
    p_role: 'owner', p_action: 'grant', p_expected_revision: null, p_changed_by: 'probe'
  })
  const role = (await db.from('memberships').select('role')
    .eq('estate_id', estate).eq('person_id', erin).single()).data.role
  // The ERROR is read, not dropped. This assertion compared two data values and
  // said nothing when the call itself failed — so a first call that errored
  // produced "retry answered differently: null vs ...", which names the symptom
  // of a defect in this probe rather than the refusal that caused it.
  first.error || second.error
    ? fail('change_membership failed: ' + (first.error?.message ?? second.error?.message))
    : JSON.stringify(first.data) === JSON.stringify(second.data)
    ? ok('the same command_id returns the SAME receipt — two tabs accepting one invite is one membership')
    : fail(\`retry answered differently: \${JSON.stringify(first.data)} vs \${JSON.stringify(second.data)}\`)
  role === 'member'
    ? ok('and the retry did not apply its own arguments over the first outcome')
    : fail('the retry changed the role to ' + role)
}

// ── 7. no object disclosure ──────────────────────────────────────────────────
{
  const absent = await db.rpc('change_membership', {
    p_command_id: randomUUID(), p_estate_id: estate, p_target_person: randomUUID(),
    p_role: null, p_action: 'revoke', p_expected_revision: null, p_changed_by: 'probe'
  })
  const foreign = await db.rpc('change_membership', {
    p_command_id: randomUUID(), p_estate_id: randomUUID(), p_target_person: alice,
    p_role: null, p_action: 'revoke', p_expected_revision: null, p_changed_by: 'probe'
  })
  absent.data?.reason_code === 'not_found' && foreign.data?.reason_code === 'not_found'
    ? ok('a membership that is not there and one in an estate you may not read answer the SAME thing')
    : fail(\`disclosure: absent=\${absent.data?.reason_code} foreign=\${foreign.data?.reason_code}\`)
  absent.data?.says === foreign.data?.says
    ? ok('and the same sentence, so the wording cannot be read as a signal either')
    : fail('the sentences differ, which is the disclosure the code was meant to close')
}

// ── how much was actually asserted ───────────────────────────────────────────
const { count: cmds } = await db.from('membership_commands')
  .select('command_id', { count: 'exact', head: true }).eq('estate_id', estate)
console.log('  ok   ' + cmds + ' command(s) recorded for this fixture estate, ' +
  (await owners()) + ' owner(s) still standing')

if (failures > 0) { console.log('\\n' + failures + ' membership failure(s)'); process.exit(1) }
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
