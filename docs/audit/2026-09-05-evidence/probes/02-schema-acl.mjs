// Captured from the audit invocation; saved afterwards without rerunning.
// Read-only metadata. Does NOT execute TRUNCATE.
import pg from 'packages/schema/node_modules/pg/lib/index.js';
const client=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});await client.connect();
console.log((await client.query(`select role,has_table_privilege(role,'public.journal','TRUNCATE') as journal_truncate,has_table_privilege(role,'public.event_types','INSERT') as event_type_insert from unnest(array['anon','authenticated','service_role']) as role`)).rows);
console.log((await client.query(`select schemaname,tablename,policyname,roles,cmd from pg_policies where schemaname='public' order by tablename`)).rows);
await client.end();
