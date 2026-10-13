import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const {exactLeaseRef}=await import(pathToFileURL(process.env.N023_SOURCE));const data=JSON.parse(readFileSync(new URL('./installed-format.json',import.meta.url)));
for(const c of data.cases)assert.equal(exactLeaseRef(c.key),c.ref);
console.log(JSON.stringify({checks:data.cases.length,seed:data.seed,installed_sha256:data.installed_sha256,cross_second_payload:data.cross_second_payload}));
