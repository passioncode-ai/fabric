import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRunLifecycle } from '../src/main/runLifecycle.ts'
const remote = { session_id: 'remote-session', state: 'active' }
const local = { session_id: 'local-session', state: 'active' }
let failRead = false, writes = 0
const db = {
  from(table) {
    assert.equal(table, 'task_runs')
    const q = { select(){return q}, eq(){return q}, neq(){return q},
      then(resolve){return Promise.resolve(failRead ? {data:null,error:{message:'unreachable'}} : {data:[remote,local],error:null}).then(resolve)} }
    return q
  },
  rpc(){ writes++; throw Error('local absence must not write a run ending') }
}
const runs = createRunLifecycle({db,estateId:'estate',actor:{kind:'system',id:'probe'}})
assert.deepEqual(await runs.reconcile(['local-session']), {ended:0,unobserved:1})
assert.deepEqual(await runs.reconcile([]), {ended:0,unobserved:2})
assert.equal(remote.state,'active'); assert.equal(local.state,'active'); assert.equal(writes,0)
failRead = true
assert.deepEqual(await runs.reconcile([]), {ended:0,unobserved:null})
// Static wiring assertion complements the real module probe: bootstrap cannot
// keep a second destructive implementation alongside this read-only one.
const main = readFileSync(new URL('../src/main/index.ts',import.meta.url),'utf8')
assert.equal(main.includes('reconcileOpenTasks('),false)
assert.equal(main.includes('releaseOrphanedLeases('),false)
assert.equal(main.includes('runs.reconcile([])'),false)
console.log('PASS restart reconciliation: remote/unknown runs remain owned; unreadable is unknown; no destructive bootstrap sweep')
