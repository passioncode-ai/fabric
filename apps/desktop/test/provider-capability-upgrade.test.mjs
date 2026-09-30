import test from 'node:test'
import assert from 'node:assert/strict'
import {CAPABILITY_MATRIX,PINNED_BUILDS,HISTORICAL_CAPABILITY_MATRIX,HISTORICAL_PINNED_BUILDS} from '../src/shared/providerCapabilityMatrix.ts'
import {receiptProblems} from '../src/shared/providerCapability.ts'
test('CLI upgrades preserve historical receipts and require new observations for every current capability',()=>{
 for(const [provider,build] of Object.entries(PINNED_BUILDS)){
  const current=CAPABILITY_MATRIX.filter(r=>r.provider===provider&&r.cliBuild===build)
  const historical=HISTORICAL_CAPABILITY_MATRIX.filter(r=>r.provider===provider)
  assert.notEqual(build,HISTORICAL_PINNED_BUILDS[provider])
  assert.deepEqual(current.map(r=>r.capability),historical.map(r=>r.capability))
  for(const row of current){assert.equal(row.status,'unverified');assert.deepEqual(receiptProblems(row),[])}
  assert(historical.some(r=>r.status!=='unverified'))
  for(const row of historical)assert(CAPABILITY_MATRIX.includes(row))
 }
})
