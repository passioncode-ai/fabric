// A real chain controller must not compensate a post-spawn error as no process.
import assert from 'node:assert/strict'
import { createChainAdvance } from '../src/main/chainAdvance.ts'
import { PtyLaunchFailure } from '../src/main/launchFailure.ts'

for (const processStarted of [false, true]) {
  const deleted = [], ended = [], events = []
  let starts = 0
  const store = {
    select(table) {
      let rel
      const q = { eq(k,v) { if(k==='rel') rel=v; return q }, then(resolve) {
        return Promise.resolve({data:table==='task_links' && rel==='follows' ? [{task_id:'follower',target_id:'parent',needs:[]}] : [],error:null,count:0}).then(resolve)
      } }; return q
    },
    // The paged read the advance now uses for every link (release review 2026-10-03).
    async selectAll(table, columns, { eq = [] } = {}) {
      const rel = eq.find(([k]) => k === 'rel')?.[1]
      return { rows: table==='task_links' && rel==='follows' ? [{task_id:'follower',target_id:'parent',needs:[]}] : [], failed: null }
    },
    async selectIn(table, columns, field, ids) {
      return { rows: ids.includes('follower') ? [{id:'follower',project_id:'project',status:'backlog',instruction:'do work',option_id:'shell'}] : [{id:'parent',status:'done'}] }
    },
    delete(table) {
      const filters={}; const q={eq(k,v){filters[k]=v; return q},then(resolve){deleted.push({table,filters});return Promise.resolve({data:[],error:null}).then(resolve)}}; return q
    }
  }
  await createChainAdvance({store, estateId:'estate', quota:async()=>null, admission:{claim:()=>({ok:true})},
    journal:{append:async e=>{events.push(e);return {seq:events.length}}},
    admitExisting:async()=>({admitted:true,receipt:{task_run_id:'run',project_id:'project',instruction:'do work'}}),
    bindRun:async()=>({ok:true}), endRun:async(...a)=>{ended.push(a);return {ok:true}},
    startTask:async()=>{ starts++; throw processStarted ? new PtyLaunchFailure('native-session') : Error('binary not found') }
  })()
  assert.equal(starts,1,'fixture must reach the actual launch')
  assert.equal(deleted.length,0,'chain delegates ownership compensation to the shared coordinator')
  assert.equal(ended.length,0,'chain may not end a generation whose begin it did not own')
  assert.equal(events.filter(e=>e.type==='chain.dispatch@1'&&e.payload.phase==='failed').length,1)
}
console.log('PASS chain launch failure: no competing lease cleanup or false ending outside shared coordinator')

// A LAUNCH FAILURE COUNTS EVEN WHEN ITS RECEIPT CANNOT BE WRITTEN (release review 2026-10-03, iteration 2,
// finding 8). The failure is counted against MAX_CHAIN_LAUNCH_ATTEMPTS by reading `chain.dispatch@1
// phase=failed` back. When that append threw inside the catch, the throw escaped the pass — every
// follower after it went unjudged — and the failure was never counted, so a follower whose launch always
// failed while the journal refused that one append was relaunched unattended on every pass, forever.
{
  const MAX = 3
  let starts = 0
  const events = []
  const store = {
    // The journal counts read back what was actually appended (the refused receipts never were).
    select() {
      const filters = []
      const field = (e, c) => (c.startsWith('payload->>') ? e.payload?.[c.slice(10)] : e[c])
      const q = {
        eq(c, v) { filters.push([c, v]); return q },
        then(resolve) {
          const n = events.filter((e) => filters.every(([c, v]) => c === 'estate_id' || field(e, c) === v)).length
          return Promise.resolve({ data: [], error: null, count: n }).then(resolve)
        }
      }
      return q
    },
    async selectAll(table, columns, { eq = [] } = {}) {
      const rel = eq.find(([k]) => k === 'rel')?.[1]
      return { rows: table === 'task_links' && rel === 'follows' ? [{ task_id: 'follower', target_id: 'parent', needs: [] }] : [], failed: null }
    },
    async selectIn(table, columns, field, ids) {
      return { rows: ids.includes('follower') ? [{ id: 'follower', project_id: 'project', status: 'backlog', instruction: 'do work', option_id: 'shell' }] : [{ id: 'parent', status: 'done' }], failed: null }
    },
    delete() { const q = { eq() { return q }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) } }; return q }
  }
  const advance = createChainAdvance({ store, estateId: 'estate', quota: async () => null, admission: { claim: () => ({ ok: true }) },
    journal: { append: async (e) => {
      if (e.type === 'chain.dispatch@1' && e.payload.phase === 'failed') throw new Error('lock timeout on the journal')
      events.push(e); return { seq: events.length }
    } },
    admitExisting: async () => ({ admitted: true, receipt: { task_run_id: 'run', project_id: 'project', instruction: 'do work' } }),
    bindRun: async () => ({ ok: true }), endRun: async () => ({ ok: true }),
    startTask: async () => { starts++; throw Error('binary not found') }
  })
  const first = await advance()
  assert.equal(first.state, 'failed_known')
  assert.match(first.says, /follower did not launch/, 'the pass did not carry the launch failure: ' + first.says)
  assert.match(first.says, /could not be recorded/, 'the pass hid that the failure was not journalled: ' + first.says)
  for (let i = 1; i < MAX + 2; i++) await advance()
  assert.equal(starts, MAX, `an unjournalled launch failure was not counted: ${starts} launches against a limit of ${MAX}`)
  assert.equal(events.filter((e) => e.type === 'routine.paused@1' && e.payload.reason_code === 'launch-retries-exhausted').length, 1,
    'the exhausted follower was not paused with its reason')
  console.log('PASS chain launch failure: counted even when its receipt could not be journalled')
}

// A PAUSE RECEIPT THAT CANNOT BE WRITTEN DOES NOT ABORT THE PASS (release review 2026-10-03, iteration 3,
// orchestration finding 5). `launchesExhausted` wrote `routine.paused@1 launch-retries-exhausted` with a
// bare append: a throw there escaped to the pass's outer catch, so every follower after the exhausted one
// went unjudged and the receipt said only "the chain pass failed". The iteration-2 dispatch-receipt shape
// applies: caught, said in the pass's problems, and the pass goes on. The exhausted follower still does
// not start — failing closed is the point of the cap.
{
  const starts = []
  const events = [1, 2, 3].map(() => ({ type: 'chain.dispatch@1', payload: { id: 'tired', phase: 'failed' } }))
  const row = (id) => ({ id, project_id: 'project', status: 'backlog', instruction: 'do work', option_id: 'shell' })
  const store = {
    select() {
      const filters = []
      const field = (e, c) => (c.startsWith('payload->>') ? e.payload?.[c.slice(10)] : e[c])
      const q = {
        eq(c, v) { filters.push([c, v]); return q },
        then(resolve) {
          const n = events.filter((e) => filters.every(([c, v]) => c === 'estate_id' || field(e, c) === v)).length
          return Promise.resolve({ data: [], error: null, count: n }).then(resolve)
        }
      }
      return q
    },
    async selectAll(table, columns, { eq = [] } = {}) {
      const rel = eq.find(([k]) => k === 'rel')?.[1]
      return { rows: table === 'task_links' && rel === 'follows'
        ? [{ task_id: 'tired', target_id: 'parent', needs: [] }, { task_id: 'fresh', target_id: 'parent', needs: [] }] : [], failed: null }
    },
    async selectIn(table, columns, field, ids) {
      return { rows: ids.map((id) => (id === 'parent' ? { id: 'parent', status: 'done' } : row(id))), failed: null }
    },
    delete() { const q = { eq() { return q }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) } }; return q }
  }
  const result = await createChainAdvance({ store, estateId: 'estate', quota: async () => null, admission: { claim: () => ({ ok: true }) },
    journal: { append: async (e) => {
      if (e.type === 'routine.paused@1' && e.payload.reason_code === 'launch-retries-exhausted') throw new Error('lock timeout on the journal')
      events.push(e); return { seq: events.length }
    } },
    admitExisting: async (id) => ({ admitted: true, receipt: { task_run_id: `run-${id}`, project_id: 'project', instruction: 'do work' } }),
    bindRun: async () => ({ ok: true }), endRun: async () => ({ ok: true }),
    startTask: async (input) => { starts.push(input.followerId) }
  })()
  assert.deepEqual(starts, ['fresh'], `the pass did not go on past the unwritable pause receipt: started ${JSON.stringify(starts)}; ${result.says}`)
  assert.equal(result.state, 'partial', result.says)
  assert.match(result.says, /tired/, 'the pass hid which follower\'s pause could not be recorded: ' + result.says)
  assert.match(result.says, /could not be recorded/, result.says)
  console.log('PASS chain launch failure: an unwritable pause receipt is said, and the pass goes on')
}
