// Read-only candidate probe: only the imported helper's disposable Unix-socket cluster is written.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { withOwnedPostgres } from '../../../../apps/desktop/test/helpers/owned-postgres.mjs'
import { decodePrivateArchive } from '../../../../apps/desktop/src/main/ceoPrivateArchive.ts'
import { digestInput } from '../../../../apps/desktop/src/shared/archive.ts'
import { createHash } from 'node:crypto'
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
console.log('CANDIDATE '+sha)
withOwnedPostgres({name:'i3_data_independent',port:58683,supabaseDefaults:true},({url,bin})=>{
 const sql=input=>execFileSync(bin+'/psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',timeout:15000}).trim()
 const j=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb"
 const id=n=>`83000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const E=id(1),P=id(2),R=id(3),B=id(4),G=id(5)
 assert.equal(sql('show listen_addresses'),'')
 assert.equal(sql('select schema_version()'),'78')
 console.log('PASS independent chain migration count78, Unix socket only')
 for(const table of ['access_requests','access_bindings','access_grants','product_connections']) for(const role of ['anon','authenticated','service_role']){
  assert.equal(sql(`select has_table_privilege('${role}','${table}','select')`),role==='service_role'?'t':'f')
  for(const op of ['insert','update','delete','truncate']) assert.equal(sql(`select has_table_privilege('${role}','${table}','${op}')`),'f')
 }
 for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_function_privilege('${role}','apply_hub_access(journal)','execute')`),'f')
 console.log('PASS independent principal ACL matrix under Supabase default privileges')
 sql(`insert into persons(id,display_name) values('${P}','Independent fixture');insert into estates(id,name) values('${E}','Independent fixture');insert into memberships(person_id,estate_id,role) values('${P}','${E}','owner');`)
 const fixture=JSON.parse(readFileSync(new URL('../../../../apps/desktop/test/fixtures/ceo-private-archive/empty.archive.json',import.meta.url),'utf8'))
 const manifest={...fixture.estate_archive,sourceEstateId:E}
 // Manifest digest incorporates the estate ID; SQL owns the actual export digest.
 // Use the candidate's ordinary codec to compute its documented input exactly.
 manifest.digest=createHash('sha256').update(digestInput(manifest,'')).digest('hex')
 const answer=JSON.parse(sql(`set role service_role;select ceo_export_private_archive('${E}','${P}',1,${j(manifest)},'')`))
 assert.equal(answer.ok,true,JSON.stringify(answer))
 assert.equal(answer.archive.source_schema_version,78)
 console.log('PASS SQL-produced archive source_schema_version78, SQL canonical validation accepted')
 let native='accepted'
 try{decodePrivateArchive(new TextEncoder().encode(JSON.stringify(answer.archive)))}catch(e){native=e.message}
 console.log('MEASURE native admission of actual SQL export: '+native)
 // Deliberately records either candidate outcome; the review determines whether it meets the contract.
 const actor=j({kind:'system',id:'independent-data-probe'})
 const append=(type,payload)=>sql(`set role service_role;select seq from append_event('${E}','${type}',${actor},${j(payload)})`)
 const expiry=new Date(Date.now()+600000).toISOString()
 append('access.requested@1',{id:R,agent_id:'example-agent',callee:'fabric-inbox',capabilities:['list_messages'],resources:['cloudflare:news@example.com'],reason:'independent probe',registry:{},binding_id:null,expires_at:expiry,poll_verifier:'a'.repeat(64)})
 append('access.decided@1',{request_id:R,decision:'allowed',binding_id:B,new_binding:true,grants:[{id:G,capability:'list_messages',resource:'cloudflare:news@example.com',expires_at:new Date(Date.now()+3600000).toISOString()}]})
 append('access.credential.claimed@1',{request_id:R,binding_id:B,verifier:'b'.repeat(64)})
 const before=sql(`select count(*) from journal where estate_id='${E}'`)
 assert.throws(()=>append('access.credential.claimed@1',{request_id:R,binding_id:B,verifier:'c'.repeat(64)}))
 assert.equal(sql(`select count(*) from journal where estate_id='${E}'`),before)
 assert.equal(sql(`select verifier from access_bindings where id='${B}'`),'b'.repeat(64))
 console.log('PASS independent second credential claim refuses atomically, first verifier retained')
 const snapshot=sql(`select jsonb_build_object('requests',(select jsonb_agg(to_jsonb(r) order by id) from access_requests r where estate_id='${E}'),'bindings',(select jsonb_agg(to_jsonb(r) order by id) from access_bindings r where estate_id='${E}'),'grants',(select jsonb_agg(to_jsonb(r) order by id) from access_grants r where estate_id='${E}'))`)
 sql(`set role service_role;select rebuild_estate_projections('${E}')`)
 assert.equal(sql(`select jsonb_build_object('requests',(select jsonb_agg(to_jsonb(r) order by id) from access_requests r where estate_id='${E}'),'bindings',(select jsonb_agg(to_jsonb(r) order by id) from access_bindings r where estate_id='${E}'),'grants',(select jsonb_agg(to_jsonb(r) order by id) from access_grants r where estate_id='${E}'))`),snapshot)
 console.log('PASS independent live access projection rebuild is byte-equivalent JSON')
})
console.log('PASS owned cluster stopped and removed; no live database targeted')
