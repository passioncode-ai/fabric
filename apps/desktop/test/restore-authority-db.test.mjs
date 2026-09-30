// Actual owned PostgreSQL: no caller database, model or provider.
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {readFileSync,readdirSync,realpathSync} from 'node:fs'
import path from 'node:path'
const dir=process.env.FABRIC_RESTORE_DB_DIR,nonce=process.env.FABRIC_RESTORE_DB_NONCE,bin=process.env.FABRIC_RESTORE_PG_BIN
if(!dir||!nonce||!bin){console.error('NOT_RUN: use run-restore-authority-db.mjs');process.exit(2)}
assert.match(path.basename(dir),/^fabric-restore-authority-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir,'owner'),'utf8'),nonce)
const args=['-h',dir,'-p','58465','-U','postgres','-d','fabric_restore_authority_owned','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
const sql=input=>execFileSync(path.join(bin,'psql'),args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
assert.equal(realpathSync(sql('show data_directory')),realpathSync(path.join(dir,'data')))
assert.equal(sql('show listen_addresses'),'')
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"),'0')
sql(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
const lit=v=>`convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const uuid=v=>`${lit(v)}::uuid`,json=v=>`${lit(JSON.stringify(v))}::jsonb`
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const OLD=id(902),OLDU=id(900),OLDV=id(901)
const files=readdirSync(new URL('../../../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()
for(const file of files){
 if(file==='20260927000065_restore_authority_boundary.sql'){
  assert.equal(sql('set role service_role;select schema_version()'),'64')
  sql(`insert into persons(id,display_name) values(${uuid(OLDU)},'old independent owner'),(${uuid(OLDV)},'old archival owner');
   insert into estates(id,name) values(${uuid(OLD)},'pre65 restored shell');
   insert into memberships(person_id,estate_id,role) values(${uuid(OLDU)},${uuid(OLD)},'owner');
   set role service_role;select restore_estate(${uuid(OLD)},${uuid(id(903))},'pre65',${json([{seq:1,type:'estate.created@1',schema_rev:'1',actor:{kind:'person',id:OLDV},project_id:null,run_id:null,node_id:null,payload:{name:'old archive',owner_person_id:OLDV},occurred_at:'2026-09-27T00:00:00.000Z'}])});
   reset role;delete from memberships where estate_id=${uuid(OLD)} and person_id=${uuid(OLDV)};`)
 }
 sql(readFileSync(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8'));sql(`insert into supabase_migrations.schema_migrations values(${lit(file.split('_')[0])})`)
}
const admitted=JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json',import.meta.url),'utf8')).maximum // the admitted schema, not a literal that goes stale
assert.equal(files.length,admitted,'final acceptance applies the exact admitted chain, never pins a historical one')
assert.equal(sql('set role service_role;select schema_version()'),String(files.length))
console.log(`PASS actual schema_version RPC ${files.length}; all migrations on disk applied`)
const U=id(1),V=id(2),SOURCE=id(10),TARGET=id(11)
const actor=p=>({kind:'person',id:p})
const archive=(person=V)=>[{seq:1,type:'estate.created@1',schema_rev:'1',actor:actor(person),project_id:null,run_id:null,node_id:null,payload:{name:'archived fixture',owner_person_id:person},occurred_at:'2026-09-27T00:00:00.000Z'}]
const restore=(target,events=archive(),source=SOURCE)=>JSON.parse(sql(`set role service_role;select restore_estate(${uuid(target)},${uuid(source)},'owned restore fixture',${json(events)})`))
const member=(target,person)=>Number(sql(`select count(*) from memberships where estate_id=${uuid(target)} and person_id=${uuid(person)}`))
sql(`insert into persons(id,display_name) values(${uuid(U)},'independent owner'),(${uuid(V)},'archival owner');
insert into estates(id,name) values(${uuid(TARGET)},'independent shell');
insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(TARGET)},'owner');`)
const result=restore(TARGET);assert.equal(result.restored,true)
const afterRestore=member(TARGET,V)
if(afterRestore)sql(`delete from memberships where estate_id=${uuid(TARGET)} and person_id=${uuid(V)}`)
sql(`set role service_role;select rebuild_estate_projections(${uuid(TARGET)})`)
const afterRebuild=member(TARGET,V)
console.log(`OBSERVED archival membership counts: restore=${afterRestore}, after independent removal + rebuild=${afterRebuild}`)
assert.equal(afterRestore,0,'restoring an archived owner assignment must not mint membership')
assert.equal(afterRebuild,0,'rebuilding imported history must not reinstate removed membership')
let groups=1
console.log('PASS restore and permanent replay boundary preserve independent authority')
const test=async(name,fn)=>{await fn();groups++;console.log('PASS '+name)}
const rpc=q=>JSON.parse(sql('set role service_role;select '+q))
const status=(e,u=U,r=1)=>rpc(`read_estate_restore_boundary(${uuid(e)},${uuid(u)},${r})`)
const rows=q=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (${q})q`))
const denied=q=>assert.throws(()=>sql(q),undefined,'SQL boundary must refuse')
const setup=(e,vRole=null)=>sql(`insert into estates(id,name) values(${uuid(e)},'independent shell');insert into memberships(person_id,estate_id,role) values(${uuid(U)},${uuid(e)},'owner')${vRole?`,(${uuid(V)},${uuid(e)},${lit(vRole)})`:''};`)
const parallel=input=>new Promise((resolve,reject)=>{const c=spawn(path.join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']});let out='';c.stdout.on('data',b=>out+=b);c.stderr.resume();c.on('error',reject);c.on('exit',code=>code?reject(new Error('owned concurrent SQL failed')):resolve(JSON.parse(out.trim())));c.stdin.end(input)})
await test('durable marker precedes first archived projection and preserves original journal field values and IDs',()=>{
 const E=id(20);setup(E,'member')
 const events=[...archive(),{...archive(U)[0],seq:3,payload:{name:'second archive fact',owner_person_id:U}}]
 sql(`create function test_boundary_before_journal() returns trigger language plpgsql as $$begin
 if NEW.estate_id=${uuid(E)} and not exists(select 1 from estate_restore_boundaries where target_estate_id=NEW.estate_id and NEW.seq=any(owner_event_seqs)) then raise exception 'Boundary was late';end if;return NEW;end$$;
 create trigger owned_boundary_preflight before insert on journal for each row execute function test_boundary_before_journal();`)
 assert.equal(restore(E,events).restored,true)
 const b=rows(`select * from estate_restore_boundaries where target_estate_id=${uuid(E)}`)[0]
 assert.deepEqual(b.owner_event_seqs,[1,3]);assert.equal(b.watermark_seq,3);assert.equal(b.event_count,2);assert.equal(b.mode,'legacy_unverified')
 const actual=rows(`select seq,type,schema_rev,actor,project_id,run_id,node_id,payload,to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') occurred_at from journal where estate_id=${uuid(E)} order by seq`)
 assert.deepEqual(actual,events)
 const before=rows(`select person_id,role,revision,changed_by from memberships where estate_id=${uuid(E)} order by person_id`)
 sql(`set role service_role;select rebuild_estate_projections(${uuid(E)})`)
 assert.deepEqual(rows(`select person_id,role,revision,changed_by from memberships where estate_id=${uuid(E)} order by person_id`),before)
 assert.equal(before.find(x=>x.person_id===V).role,'member')
 sql('drop trigger owned_boundary_preflight on journal;drop function test_boundary_before_journal()')
})
await test('exact Estate and archived sequence guard does not suppress unrelated trusted fresh bootstrap',()=>{
 const E=id(30),W=id(31);sql(`insert into persons(id,display_name) values(${uuid(W)},'new founder')`)
 sql(`set role service_role;select set_config('fabric.restoring','true',false);select set_config('fabric.restore_boundary','true',false);
 select append_event(${uuid(E)},'estate.created@1',${json(actor(W))},${json({name:'fresh',owner_person_id:W,restore_boundary:true,source_estate_id:SOURCE})});`)
 assert.equal(member(E,W),1);assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'0')
 // Same marked Estate, later independent creation fact: suppression is exact-sequence.
 sql(`set role service_role;select append_event(${uuid(TARGET)},'estate.created@1',${json(actor(W))},${json({name:'later trusted fact',owner_person_id:W})})`)
 assert.equal(member(TARGET,W),1)
})
await test('numeric and canonical decimal-string sequences preserve identical bounds and archival owner suppression',()=>{
 const max=Number.MAX_SAFE_INTEGER, results=[]
 for(const [i,seqs] of [[0,[1,max]],[1,['1',String(max)]],[2,[1,String(max)]]]){
  const E=id(35+i);setup(E)
  const events=seqs.map(seq=>({...archive()[0],seq}))
  assert.equal(restore(E,events).restored,true)
  assert.equal(member(E,V),0);assert.equal(member(E,U),1)
  sql(`set role service_role;select rebuild_estate_projections(${uuid(E)})`)
  assert.equal(member(E,V),0);assert.equal(member(E,U),1)
  const b=rows(`select watermark_seq,event_count,owner_event_seqs from estate_restore_boundaries where target_estate_id=${uuid(E)}`)[0]
  assert.deepEqual(b,{watermark_seq:max,event_count:2,owner_event_seqs:[1,max]})
  results.push(rows(`select seq,type,schema_rev,actor,payload from journal where estate_id=${uuid(E)} order by seq`))
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2])
})
await test('table mutations, internal helpers, raw events and caller flags cannot manufacture a boundary',()=>{
 for(const role of ['anon','authenticated','service_role']){
  denied(`set role ${role};select * from estate_restore_boundaries`)
  assert.equal(sql(`select has_table_privilege('${role}','estate_restore_boundaries','INSERT,UPDATE,DELETE,TRUNCATE')`),'f')
  denied(`set role ${role};insert into estate_restore_boundaries(target_estate_id,source_estate_id,watermark_seq,event_count,owner_event_seqs) values(${uuid(id(40))},${uuid(SOURCE)},1,1,array[1])`)
  denied(`set role ${role};select record_estate_restore_boundary(${uuid(id(40))},${uuid(SOURCE)},${json(archive())})`)
  denied(`set role ${role};select restore_estate_internal(${uuid(id(40))},${uuid(SOURCE)},'not allowed',${json(archive())})`)
  denied(`set role ${role};select apply_estate_and_projects(null::journal)`)
 }
 for(const role of ['anon','authenticated']){
  denied(`set role ${role};select restore_estate(${uuid(id(40))},${uuid(SOURCE)},'not allowed',${json(archive())})`)
  denied(`set role ${role};select read_estate_restore_boundary(${uuid(TARGET)},${uuid(U)},1)`)
 }
 sql(`set role service_role;select append_event(${uuid(TARGET)},'estate.restore.boundary@1',${json(actor(U))},${json({target_estate_id:TARGET,owner_event_seqs:[1]})})`)
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(TARGET)}`),'1')
 assert.equal(sql(`select owner_event_seqs::text from estate_restore_boundaries where target_estate_id=${uuid(TARGET)}`),'{1}')
 denied(`update estate_restore_boundaries set mode='verified' where target_estate_id=${uuid(TARGET)}`)
 denied(`delete from estate_restore_boundaries where target_estate_id=${uuid(TARGET)}`)
 assert.equal(sql(`select mode from estate_restore_boundaries where target_estate_id=${uuid(TARGET)}`),'legacy_unverified')
})
await test('scoped status rechecks held membership and never upgrades legacy proof to verified private recovery',()=>{
 const s=status(TARGET);assert.equal(s.status,'recorded');assert.equal(s.mode,'legacy_unverified');assert.equal(s.private_import,'unavailable')
 assert.equal(status(TARGET,V).reason_code,'unavailable')
 sql(`update memberships set changed_by='owned authority revision test' where estate_id=${uuid(TARGET)} and person_id=${uuid(U)}`)
 assert.equal(status(TARGET).reason_code,'unavailable');assert.equal(status(TARGET,U,2).status,'recorded')
})
await test('failed later projection rolls back marker/journal and permits a clean retry without granting membership',()=>{
 const E=id(50);setup(E)
 const broken=[...archive(),{...archive()[0],seq:2,type:'project.created@1',payload:{id:'not-a-uuid'}}]
 denied(`set role service_role;select restore_estate(${uuid(E)},${uuid(SOURCE)},'broken',${json(broken)})`)
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'0')
 assert.equal(sql(`select count(*) from journal where estate_id=${uuid(E)}`),'0');assert.equal(member(E,V),0)
 assert.equal(member(E,U),1);assert.equal(restore(E).restored,true);assert.equal(member(E,V),0)
})
await test('same target concurrent restores have one boundary and no duplicate authority',async()=>{
 const E=id(60);setup(E)
 const input=`set role service_role;select restore_estate(${uuid(E)},${uuid(SOURCE)},'race',${json(archive())})`
 const results=await Promise.all([parallel(input),parallel(input)])
 assert.equal(results.filter(r=>r.restored).length,1);assert.equal(results.find(r=>!r.restored).reason_code,'not_empty')
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'1');assert.equal(member(E,V),0)
})
await test('same Estate, malformed sequences and failed global Project collision preserve legacy refusal/rollback',()=>{
 assert.equal(restore(SOURCE).reason_code,'same_estate')
 for(const seq of [null,0,-1,1.5,9007199254740992,{},[],true,false,'','0','-1','+1','01','1.0','1.5','1e0','1E0',' 1','1 ','1\n','\t1','\u00a01','9007199254740992','NaN','Infinity']){
  const E=id(70);denied(`set role service_role;select restore_estate(${uuid(E)},${uuid(SOURCE)},'invalid',${json([{...archive()[0],seq}])})`)
  assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'0')
 }
 for(const events of [[...archive(),archive()[0]],[...archive(),{...archive()[0],seq:'1'}],[{...archive()[0],seq:'2'},archive()[0]]])denied(`set role service_role;select restore_estate(${uuid(id(70))},${uuid(SOURCE)},'invalid',${json(events)})`)
 const E=id(71),source=id(72),project=id(73);setup(E);setup(source)
 sql(`insert into projects(id,estate_id,name) values(${uuid(project)},${uuid(source)},'original source')`)
 const events=[...archive(),{...archive()[0],seq:2,type:'project.created@1',payload:{id:project,name:'must roll back'}}]
 denied(`set role service_role;select restore_estate(${uuid(E)},${uuid(source)},'collision',${json(events)})`)
 assert.equal(sql(`select name from projects where id=${uuid(project)}`),'original source')
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'0')
})
await test('empty legacy restore is marked unverified without invented owner; marker survives empty rebuild',()=>{
 const E=id(80);assert.equal(restore(E,[]).restored,true)
 assert.equal(sql(`select count(*) from memberships where estate_id=${uuid(E)}`),'0')
 assert.equal(sql(`select event_count from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'0')
 denied(`set role service_role;select restore_estate(${uuid(E)},${uuid(SOURCE)},'repeat empty',${json([])})`)
 sql(`set role service_role;select rebuild_estate_projections(${uuid(E)})`)
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(E)}`),'1')
})
await test('pre65 restored Estates are NOT_MIGRATED: no guessed backfill, status unknown, old replay risk explicit',()=>{
 assert.equal(sql(`select count(*) from estate_restore_boundaries where target_estate_id=${uuid(OLD)}`),'0')
 const s=status(OLD,OLDU);assert.equal(s.status,'not_recorded');assert.equal(s.prior_restore,'unknown');assert.equal(s.private_import,'unavailable')
 sql(`set role service_role;select rebuild_estate_projections(${uuid(OLD)})`)
 assert.equal(member(OLD,OLDV),1,'known historical gap must remain explicit, not a claimed retrospective repair')
 console.log('NOT_MIGRATED: pre65 restored fixture has no reliable marker; old replay still creates archived owner')
})
await test('concern projector preserves latest59 body exactly apart from the reviewed owner predicate',()=>{
 const source=readFileSync(new URL('../../../supabase/migrations/20260910000059_project_configured.sql',import.meta.url),'utf8')
 const baseline=source.slice(source.indexOf('create or replace function apply_estate_and_projects'),source.indexOf('create or replace function apply_project_servers')).trim()
 const migration=readFileSync(new URL('../../../supabase/migrations/20260927000065_restore_authority_boundary.sql',import.meta.url),'utf8')
 const start=migration.indexOf('create or replace function apply_estate_and_projects'),end=migration.indexOf('end $$;',start)+7
 const current=migration.slice(start,end).replace(/      -- Archived ownership[^]*?         and e.payload->>'owner_person_id' is not null/,"      if e.payload->>'owner_person_id' is not null")
 assert.equal(current,baseline)
})
console.log(`PASS ${groups} owned actual PostgreSQL groups / ${files.length} migrations; legacy-unverified only, no private archive activation`)
