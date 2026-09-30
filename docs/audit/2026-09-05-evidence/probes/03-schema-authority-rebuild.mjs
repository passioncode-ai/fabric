// Captured from the audit invocation; saved afterwards without rerunning.
// Temporary random fixtures inside one transaction; always rolled back.
import pg from 'packages/schema/node_modules/pg/lib/index.js';
import {randomUUID} from 'node:crypto';
const c=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});await c.connect();await c.query('BEGIN');
try{
const A=randomUUID(),B=randomUUID(),p=randomUUID(),pB=randomUUID(),g=randomUUID(),actor={kind:'system',id:'read-only-audit'};
const app=async(estate,type,payload,project=null)=>(await c.query(`select (append_event($1,$2,$3::jsonb,$4::jsonb,'1',$5)).seq`,[estate,type,JSON.stringify(actor),JSON.stringify(payload),project])).rows;
await app(A,'estate.created@1',{name:'Audit rollback A'});await app(B,'estate.created@1',{name:'Audit rollback B'});
await app(A,'project.created@1',{id:p,name:'Original'},p);await app(B,'project.created@1',{id:pB,name:'Other'},pB);await app(A,'project.updated@1',{id:p,name:'Updated'},p);
const rev=async()=>Number((await c.query('select config_revision from projects where id=$1',[p])).rows[0].config_revision);
const before=await rev();await c.query('select rebuild_estate_projections($1)',[A]);const after=await rev();await c.query('select rebuild_estate_projections($1)',[A]);console.log('rebuild config_revision=',[before,after,await rev()]);
await c.query(`insert into grants (id,estate_id,floor_class,target,expires_at,consumed_at) values ($1,$2,'money','wrong-target','2000-01-01','2000-01-02')`,[g,B]);
await c.query('SET LOCAL ROLE service_role');
const receipt=await c.query(`insert into effect_intents(estate_id,action_class,floor_class,grant_id,receipt_seq) values ($1,'file.overwrite','deletion',$2,987654321),($1,'file.overwrite','deletion',$2,987654322) returning id`,[A,g]);
console.log('schema accepted mismatched estate/class, expired, consumed grant with nonexistent receipts twice=',receipt.rowCount);
await c.query('RESET ROLE');
await app(B,'project.created@1',{id:p,name:'Cross-estate overwrite'},p);
console.log('project name after B event targeting A existing UUID=',(await c.query('select estate_id=$2 as still_A,name from projects where id=$1',[p,A])).rows[0]);
const fid=randomUUID();await app(A,'memory.project.recorded@1',{id:fid,claim:'cross estate payload'},pB);
console.log('accepted estate A memory for project in B=',(await c.query('select estate_id=$2 as estate_A,project_id=$3 as project_B from memory_facts where id=$1',[fid,A,pB])).rows[0]);
const future=randomUUID();await app(A,'memory.project.recorded@1',{id:future,claim:'future scheduled fact',valid_from:'2099-01-01'},p);
console.log('future fact included by production current filter=',(await c.query('select count(*)::int n from memory_facts where id=$1 and valid_to is null',[future])).rows[0].n);
const task=randomUUID();await app(A,'task.started@1',{id:task,instruction:'audit',option_id:'shell'},p);
await app(A,'task.abandoned@1',{id:task,reason:'restarted'},p);
await c.query("update project_tasks set status='open',finished_at=null,abandoned_reason=null where id=$1",[task]);await c.query('select rebuild_estate_projections($1)',[A]);console.log('abandon repair=',(await c.query('select status,abandoned_reason from project_tasks where id=$1',[task])).rows[0]);
}finally{await c.query('ROLLBACK');console.log('ROLLBACK complete');await c.end()}
