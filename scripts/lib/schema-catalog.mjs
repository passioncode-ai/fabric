// What a database's `public` schema IS, as rows that compare across two databases (CO-199): every function's
// definition, volatility, settings and grants; every column, constraint, index, policy, trigger, relation grant
// and view; the registered event types; and the migration ledger's versions. No data rows besides event_types.
// Used by apps/desktop/test/write-rules-db.test.mjs (owned cluster) and scripts/probe-fresh-vs-upgraded.mjs
// (two disposable stacks, the second upgraded by `supabase migration up`).
export const CATALOG = {
  functions: `select p.proname, pg_get_function_identity_arguments(p.oid) as args, md5(pg_get_functiondef(p.oid)) as def,
    p.prosecdef, p.provolatile, coalesce(p.proconfig::text,'') as config, coalesce(p.proacl::text,'') as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')`,
  columns: `select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') as dflt
    from information_schema.columns where table_schema='public'`,
  constraints: `select c.conrelid::regclass::text as rel, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'`,
  indexes: `select tablename, indexname, indexdef from pg_indexes where schemaname='public'`,
  policies: `select tablename, policyname, cmd, coalesce(qual,'') as qual, coalesce(with_check,'') as chk, roles::text
    from pg_policies where schemaname='public'`,
  triggers: `select tgrelid::regclass::text as rel, tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal`,
  relations: `select c.relname, c.relkind, c.relrowsecurity, coalesce(c.relacl::text,'') as acl from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m','S','p')`,
  views: `select viewname, md5(definition) as def from pg_views where schemaname='public'`,
  eventTypes: `select type, projects, note from event_types`,
  ledger: `select version from supabase_migrations.schema_migrations`
}

/** `rows(sql)` returns the query's rows as JSON objects; the catalog is each query's rows in one canonical order. */
export const catalogOf = (rows) => Object.fromEntries(Object.entries(CATALOG).map(([k, q]) =>
  [k, rows(`select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]') from (${q}) q`)]))

/** The parts in which two catalogs differ, each with a few of its differing rows; [] when they are one schema. */
export function catalogDifferences(a, b, sample = 3) {
  const out = []
  for (const k of Object.keys(CATALOG)) {
    const as = new Set((a[k] ?? []).map((r) => JSON.stringify(r))), bs = new Set((b[k] ?? []).map((r) => JSON.stringify(r)))
    const onlyA = [...as].filter((r) => !bs.has(r)), onlyB = [...bs].filter((r) => !as.has(r))
    if (onlyA.length || onlyB.length) out.push({ part: k, onlyFirst: onlyA.slice(0, sample), onlySecond: onlyB.slice(0, sample), counts: [onlyA.length, onlyB.length] })
  }
  return out
}
