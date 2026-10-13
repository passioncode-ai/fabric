import test from 'node:test';import assert from 'node:assert/strict';import {preparedFixture} from './fixture.mjs';
const foreign='55555555-5555-4555-8555-555555555555';
test('mismatched constructor estate refuses actual foreign scoped-store projection',async()=>{
 let f;try{f=preparedFixture({deps:{estateId:foreign}})}catch{return}
 const r=await f.inputs.prepare(f.request);assert.notEqual(r.state,'observed',JSON.stringify({state:r.state,packetEstate:r.packet?.estateId,readEstate:f.store.scope.estateId}));
});
test('changed scoped-store estate cannot supply prepared currentness',async()=>{
 const f=preparedFixture(),r=await f.inputs.prepare(f.request);assert.equal(r.state,'observed');
 f.store.scope.estateId=foreign;assert.equal(await f.inputs.current(r.packet),false);
});
