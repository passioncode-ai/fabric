// The workspace publication accepts the hosted ci verdict for the exact commit it publishes (2026-10-19): the local
// fast gate on a machine at load 30 to 200 failed on timing tests or timed out three runs in a row, while the hosted
// ci, the same `scripts/ci.sh fast`, was green on that commit. Anything short of that exact green run is no verdict.
import assert from 'node:assert/strict'
import test from 'node:test'
import { hostedCiVerdict } from '../lib/hosted-verdict.mjs'

const SHA = 'a'.repeat(40)
const runs = (list) => async () => JSON.stringify(list)

test('a completed, successful ci run on the exact commit is a verdict', async () => {
  const v = await hostedCiVerdict(SHA, { exec: runs([{ headSha: SHA, status: 'completed', conclusion: 'success', databaseId: 7 }]) })
  assert.deepEqual(v, { green: true, run: 7 })
})

test('a failed, running or other-commit run is no verdict, and the local gate runs', async () => {
  for (const list of [
    [{ headSha: SHA, status: 'completed', conclusion: 'failure', databaseId: 1 }],
    [{ headSha: SHA, status: 'in_progress', conclusion: '', databaseId: 2 }],
    [{ headSha: 'b'.repeat(40), status: 'completed', conclusion: 'success', databaseId: 3 }],
    []
  ]) assert.equal((await hostedCiVerdict(SHA, { exec: runs(list) })).green, false, JSON.stringify(list))
})

test('a newer failed run on the same commit outweighs an older green one', async () => {
  const v = await hostedCiVerdict(SHA, { exec: runs([
    { headSha: SHA, status: 'completed', conclusion: 'failure', databaseId: 9 },
    { headSha: SHA, status: 'completed', conclusion: 'success', databaseId: 8 }
  ]) })
  assert.equal(v.green, false)
})

test('gh missing, unauthenticated or answering nonsense is no verdict, with its reason', async () => {
  const thrown = await hostedCiVerdict(SHA, { exec: async () => { throw new Error('gh: command not found') } })
  assert.deepEqual([thrown.green, /gh: command not found/.test(thrown.why)], [false, true])
  assert.equal((await hostedCiVerdict(SHA, { exec: async () => 'not json' })).green, false)
  assert.equal((await hostedCiVerdict('not-a-sha', { exec: runs([]) })).green, false)
})
