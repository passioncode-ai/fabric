// #region hub-authority-boundaries — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { withOwnedPostgres } from './helpers/owned-postgres.mjs'
const checks = ({url,bin}) => {
 const sql = input => execFileSync(bin+'/psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
 const j = v => "'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb"
 const E='80000000-0000-4000-8000-000000000001'
 const actor="'{\"kind\":\"system\",\"id\":\"fabric-hub\"}'"
 const append=(type,payload)=>sql(`set role service_role;select seq from append_event('${E}','${type}',${actor},${j(payload)})`)
 const refuses=(type,payload,pattern)=>assert.throws(()=>append(type,payload),e=>pattern.test(String(e.stderr)))
 const req=id=>({id,agent_id:'example-agent',callee:'fabric-inbox',capabilities:['list_messages'],resources:['cloudflare:news@example.com'],reason:'read news',registry:{},binding_id:null,expires_at:new Date(Date.now()+600000).toISOString(),poll_verifier:'a'.repeat(64)})
 const conn=id=>({id,product:'fabric-inbox',server:'https://mail.example.com',mcp_url:'https://mail.example.com/mcp',key_id:'key',client_id:'client',level:'admin',send:'send',key_expires_at:null,secret_ref:{project:'fabric',env:'local',name:'SLOT'},supersedes:null})
 let failed=0
 const test=(name,fn)=>{try{fn();console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}
 test('DA-6 plaintext poll secret is refused before journal insertion',()=>refuses('access.requested@1',{...req('80000000-0000-4000-8000-000000000011'),poll_secret:'plaintext'},/undocumented|carries/))
 test('DA-6 plaintext credential is refused before journal insertion',()=>refuses('access.credential.claimed@1',{binding_id:'80000000-0000-4000-8000-000000000021',request_id:'80000000-0000-4000-8000-000000000011',verifier:'b'.repeat(64),credential:'plaintext'},/undocumented|carries/))
 test('DA-6 plaintext product secret is refused before journal insertion',()=>refuses('product.connected@1',{...conn('80000000-0000-4000-8000-000000000041'),client_secret:'plaintext'},/undocumented|carries/))
 test('DA-4 binding/request/grant ids have one spelling',()=>{
  refuses('access.requested@1',{...req('80000000-0000-4000-8000-000000000012'),binding_id:'{A0000000-0000-4000-8000-000000000021}'},/non-canonical/)
  refuses('access.decided@1',{request_id:'A0000000000040008000000000000011',grants:[]},/non-canonical/)
  refuses('access.decided@1',{request_id:'80000000-0000-4000-8000-000000000011',grants:[{id:'A0000000-0000-4000-8000-000000000031'}]},/non-canonical/)
 })
 test('ER-2 replacement requires the exact live connection id',()=>{
  const A='80000000-0000-4000-8000-000000000042',B='80000000-0000-4000-8000-000000000043',C='80000000-0000-4000-8000-000000000044'
  append('product.connected@1',conn(A))
  refuses('product.connected@1',conn(B),/supersedes|already connected/)
  append('product.connected@1',{...conn(B),supersedes:A})
  refuses('product.connected@1',{...conn(C),supersedes:A},/supersedes|changed/)
  assert.equal(sql(`select id from product_connections where estate_id='${E}' and removed_at is null`),B)
  sql(`select rebuild_estate_projections('${E}')`)
  assert.equal(sql(`select id from product_connections where estate_id='${E}' and removed_at is null`),B)
 })
 test('DA-2 restored pending request loses its poll verifier and cannot be decided',()=>{
  const T='80000000-0000-4000-8000-000000000002',R='80000000-0000-4000-8000-000000000013'
  const events=[{seq:1,type:'access.requested@1',schema_rev:'1',actor:{kind:'system',id:'fabric-hub'},project_id:null,run_id:null,node_id:null,payload:req(R),occurred_at:new Date().toISOString()}]
  sql(`insert into estates(id,name) values('${T}','restored');insert into estate_restore_boundaries(target_estate_id,source_estate_id,watermark_seq,event_count,owner_event_seqs) values('${T}','${E}',1,1,'{}');select restore_estate_events('${T}',${j(events)})`)
  assert.equal(sql(`select coalesce(poll_verifier,'none') from access_requests where id='${R}'`),'none')
  assert.throws(()=>sql(`set role service_role;select append_event('${T}','access.decided@1',${actor},${j({request_id:R,decision:'denied'})})`),e=>/restored request/.test(String(e.stderr)))
  sql(`select rebuild_estate_projections('${T}')`)
  assert.equal(sql(`select coalesce(poll_verifier,'none') from access_requests where id='${R}'`),'none')
 })
 if(failed)throw new Error(failed+' boundary tests failed')
}
if (process.env.FABRIC_DISPATCH_TEST_DATABASE_URL) {
 assert.match(new URL(process.env.FABRIC_DISPATCH_TEST_DATABASE_URL).pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
 checks({url:process.env.FABRIC_DISPATCH_TEST_DATABASE_URL,bin:process.env.FABRIC_PG_BIN??'/opt/homebrew/opt/postgresql@17/bin'})
} else withOwnedPostgres({ name:'hub_boundaries',port:58480,supabaseDefaults:true },checks)
// #endregion hub-authority-boundaries
