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
