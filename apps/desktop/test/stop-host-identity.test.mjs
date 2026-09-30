import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createStopHostIdentity } from '../src/main/stopHostIdentity.ts'
const root=mkdtempSync(path.join(tmpdir(),'fabric-stop-host-'))
try {
 const first=createStopHostIdentity(root),next=createStopHostIdentity(root)
 assert.equal(first.hostInstanceId,next.hostInstanceId);assert.notEqual(first.bootId,next.bootId)
 const file=path.join(root,'stop-host','installation-id')
 writeFileSync(file,'invalid-id')
 assert.throws(()=>createStopHostIdentity(root),/identity is unreadable/)
 assert.equal(readFileSync(file,'utf8'),'invalid-id','corrupt recovery identity must not be overwritten')
} finally {rmSync(root,{recursive:true,force:true})}
console.log('PASS Stop host identity: persistent installation, distinct invocation, corruption retained and refused')
