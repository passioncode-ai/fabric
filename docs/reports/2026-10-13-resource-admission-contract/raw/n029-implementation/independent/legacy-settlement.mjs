import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {preparedFixture} from './fixture.mjs';
const {compileContextPack}=await import(pathToFileURL(process.env.N029_COMPILER).href);
test('ordinary compiler keeps prompt rejection for legacy degraded handling',async()=>{
 const f=preparedFixture();f.readHook=table=>{if(table==='project_repos')throw Error('transport rejected');if(table==='memory_facts')return new Promise(()=>{})};
 const result=await Promise.race([compileContextPack({store:f.store,projectId:f.id.project}).then(()=> 'fulfilled',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('pending'),40))]);
 assert.equal(result,'rejected');
});
