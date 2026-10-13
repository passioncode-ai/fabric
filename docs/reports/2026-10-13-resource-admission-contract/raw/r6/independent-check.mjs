import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const root = process.env.FABRIC_REVIEW_ROOT
if (!root) throw Error('FABRIC_REVIEW_ROOT required')
const modulePath = root + '/apps/desktop/src/main/resourceAttemptObservation.ts'
const { createResourceAttemptObservation: create, summarizeResourceObservations: summarize, compareResourceObservations: compare } = await import(pathToFileURL(modulePath))
const h = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const v = n => ({ workerSlots:n, memoryBytes:n, diskBytes:n, cpuMilliCores:n })
const base = { attemptDigest:h('attempt'),phase:'admission',outcome:'accepted',reason:'admitted',durationMs:10,requested:v(2),reserved:v(1),snapshotDigest:h('snapshot'),policyDigest:h('policy') }
let checked=0
for (let n=0;n<256;n++) {
 const r={...base,attemptDigest:h(n)}
 for (const delta of [{requested:v(n+3)},{reserved:v(0)},{snapshotDigest:h(['other',n])},{policyDigest:h(['other',n])}]) {
  const c=create(2); assert.equal(c.record(r),'recorded'); assert.equal(c.record({...r,...delta}),'invalid');
  assert.equal(c.export().coverage.complete,false); assert.equal(c.export().coverage.duplicates,0); checked++
 }
}
let accessed=0
for(const key of ['attemptDigest','phase','outcome','reason','durationMs','requested','reserved','snapshotDigest','policyDigest']) {
 const candidate={...base};Object.defineProperty(candidate,key,{enumerable:true,get(){accessed++;throw Error('must not read')}})
 const c=create(2);assert.equal(c.record(candidate),'invalid');assert.equal(c.export().records.length,0);checked++
}
assert.equal(accessed,0)
for(const privateKey of ['token','path','instruction','owner','lesson','permission','grant','policyPromotion']) {
 const c=create(2);assert.equal(c.record({...base,[privateKey]:'PRIVATE_SENTINEL'}),'invalid');assert.ok(!JSON.stringify(c.export()).includes('PRIVATE_SENTINEL'));checked++
}
const c=create(2);c.record({...base,durationMs:null});const corpus=c.export();
const summary=summarize(corpus);assert.equal(summary.admissionLatencyMs,null);assert.equal(summary.unknownLatencySamples,1)
const manifest={mode:'synthetic',taskSetDigest:h('tasks'),acceptanceDigest:h('accept'),environmentDigest:h('env'),policyDigest:base.policyDigest,sourceDigest:h('source'),evidence:corpus}
const comparison=compare(manifest,manifest);assert.equal(comparison.comparable,false);assert.equal(comparison.admissionLatencyDeltaMs,null);assert.equal(comparison.helped,'not_established');assert.equal(comparison.policyPromotion,false)
const receipt={originalCandidate:'17aadd81ee315b2f21ab7a2131d71b6ad551b9a8',executor:process.env.FABRIC_REVIEW_ACTOR||'local-replay',checks:checked,verdict:'PASS_scoped',sourceSha256:createHash('sha256').update(readFileSync(modulePath)).digest('hex'),limits:['No native/SQL/provider runtime or performance acceptance','Trusted bounded synchronous sink; no timing-neutral sandbox','Synthetic allowlist/conflict/missing-data checks only']}
console.log(JSON.stringify(receipt))
