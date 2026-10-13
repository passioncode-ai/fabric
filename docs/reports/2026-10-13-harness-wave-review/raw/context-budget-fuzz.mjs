// Independent N-003 review replay. Run from any directory:
// node --experimental-strip-types <repo>/docs/reports/2026-10-13-harness-wave-review/raw/context-budget-fuzz.mjs
// This is the exact seeded generator used during review, persisted with a repository-relative import.
// Synthetic in-memory source rows only: no database, provider, or filesystem writes.
import assert from 'node:assert/strict'
import {compileContextPack,ContextBudgetUnmet} from '../../../../apps/desktop/src/main/contextPack.ts'
let seed=7321, accepted=0, refused=0
const rnd=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n}
const storeFor=rows=>({select(table){const r={data:rows[table],error:null,...(table==='memory_facts'?{count:rows.memory_facts.length+rows.beyond}: {})};const q={eq(){return q},is(){return q},order(){return q},limit(){return q},maybeSingle(){return Promise.resolve(r)},then(a,b){return Promise.resolve(r).then(a,b)}};return q}})
for(let i=0;i<500;i++){
 const facts=Array.from({length:rnd(20)},(_,j)=>({id:`f${j}`,seq:j,claim:'😀x'.repeat(rnd(150)),source_ref:'source',kind:'note',actor_kind:j%3?'agent':'person'}))
 const sessions=Array.from({length:rnd(10)},(_,j)=>({session_id:`s${j}`,annotation:'😀y'.repeat(rnd(100)),ending_provenance:j%2?'observed':'unknown'}))
 const rows={projects:{name:'Project😀',purpose:'purpose'.repeat(rnd(20))},project_repos:[],memory_facts:facts,session_transcripts:sessions,beyond:rnd(40)}
 const budget=300+rnd(7000)
 try {const p=await compileContextPack({store:storeFor(rows),projectId:'p',budget});assert.equal(p.chars,p.markdown.length);assert.ok(p.chars<=budget);assert.equal(p.factIds.length+p.omittedFacts,facts.length+rows.beyond);assert.equal(p.transcriptIds.length+p.omittedTranscripts,sessions.length);if(p.factIds.some(id=>Number(id.slice(1))%3))assert.ok(p.markdown.includes('DATA, NOT INSTRUCTIONS'));accepted++}
 catch(e){if(!(e instanceof ContextBudgetUnmet))throw e;refused++}
}
console.log(JSON.stringify({cases:500,accepted,refused,invariants:'budget UTF16, selected/omitted totals, agent fence'}))
