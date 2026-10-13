import test from 'node:test';import assert from 'node:assert/strict';import {preparedFixture} from './fixture.mjs';
test('equal-looking store.scope replacement cannot hide changed actual closure scope',async()=>{
 const f=preparedFixture(),captured=f.store.scope;f.store.scope={...captured};captured.estateId='55555555-5555-4555-8555-555555555555';
 const r=await f.inputs.prepare(f.request);console.log(JSON.stringify({state:r.state,actualReadEstates:f.reads.map(x=>x.filters.find(([key])=>key==='estate_id')?.[1])}));
 assert.notEqual(r.state,'observed');
});
