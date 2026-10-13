import test from 'node:test';import assert from 'node:assert/strict';import {preparedFixture} from './fixture.mjs';
test('actual compiler rejection cannot release its pending sibling query',async()=>{
 const f=preparedFixture({deps:{timeoutMs:25}});let pending=0;
 f.readHook=table=>{if(table==='project_repos')throw Error('transport rejected');if(table==='memory_facts'){pending++;return new Promise(()=>{})}};
 for(let i=0;i<5;i++)assert.equal((await f.inputs.prepare(f.request)).state,'unknown');
 console.log(JSON.stringify({pending}));assert.equal(pending,1);
});
