import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const source=process.env.N034_SOURCE;if(!source)throw Error('N034_SOURCE required')
const {createResourcePoolRegistry}=await import(pathToFileURL(source).href)
async function setup(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'n034-independent-')));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const host={hostInstanceId:randomUUID(),bootId:randomUUID()};await fs.mkdir(path.join(root,'stop-host'));await fs.writeFile(path.join(root,'stop-host/installation-id'),host.hostInstanceId+'\n')
 const config={installationRoot:root,hostId:host.hostInstanceId,poolId:'fixed',estateId:randomUUID(),maxUnits:4,maxRecordBytes:2048,maxRegistryBytes:8192,timeoutMs:10000}
 const registry=createResourcePoolRegistry(config,{host});assert.equal((await registry.provision()).state,'observed');const acquired=await registry.acquire();assert.equal(acquired.state,'observed')
 const ledger=path.join(root,'resource-pools',(await fs.readdir(path.join(root,'resource-pools')))[0]);return {root,host,config,registry,writer:acquired.value,ledger}
}
test('cached clean seal result belongs only to original opaque writer',async t=>{
 const f=await setup(t),sealed=await f.registry.seal(f.writer);assert.equal(sealed.state,'observed')
 assert.equal((await f.registry.seal({...f.writer})).state,'unknown','copied writer cannot replay successful seal receipt')
 assert.equal((await f.registry.seal(f.writer)).state,'observed','original writer may retry identical seal')
})
test('changed raw head bytes cannot retain the exact head digest claim',async t=>{
 const f=await setup(t),file=path.join(f.ledger,'head.json'),before=await fs.readFile(file,'utf8')
 await fs.writeFile(file,before+' ')
 assert.equal((await f.registry.snapshot(f.writer)).state,'unknown','noncanonical stored head must not normalize into unchanged digest')
 await fs.writeFile(file,before);assert.equal((await f.registry.seal(f.writer)).state,'observed')
})
