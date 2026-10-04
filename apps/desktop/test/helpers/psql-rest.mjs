// A PostgREST-SHAPED client that answers from a real migrated schema through `psql`.
//
// WHY IT EXISTS. A column list is a string, so `tsc` is perfectly happy with a
// read of a column no migration creates — `digestRead.ts` selected
// `memory_facts.supersedes` for weeks, and the first time anybody saw it was a
// red banner at the end of the operator's first run. A fake database cannot
// catch that: it answers whatever the probe wrote into it. This answers from the
// owned cluster `withOwnedPostgres` built from the whole migration chain, so a
// column, a table or a filter value the schema refuses comes back as the
// `{ error }` the real gateway would return.
//
// WHAT IT IS NOT. It is not PostgREST: it renders the builder calls the main
// process actually uses (select with aliases, eq/neq/gt/gte/lt/lte, is, not-is,
// in, order, limit, range, maybeSingle/single, count) into one SQL statement.
// Anything else THROWS rather than being approximated, so a read this model
// does not understand fails the probe instead of passing it. It proves the
// schema the query names, not the gateway's grammar — `or()` and `textSearch`
// are deliberately absent.
//
// `maxRows` mirrors PostgREST's `max_rows` (1000 in `supabase/config.toml`): an answer never holds more rows
// than that, however many match and whatever limit the builder asked for, and nothing says it was cut —
// exactly what the gateway does. Omitted, nothing is capped (the older probes' behaviour). The hub's reads
// are probed with it on (verification iteration 2 for 0.3.1, ER-8/DA-1: grants and bindings read as the
// 1000 / 500 oldest rows).
import { execFileSync } from 'node:child_process'

const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`psql-rest: not a plain identifier: ${name}`)
  return `"${name}"`
}
const literal = (value) => {
  if (value === null) return 'null'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `'${String(value).replace(/'/g, "''")}'`
}

/** `a,b:c` → `"a", "c" as "b"`. Embedded resources and `*` are refused. */
function columnsOf(list) {
  return list.split(',').map((raw) => {
    const c = raw.trim()
    const [alias, column] = c.includes(':') ? c.split(':') : [c, c]
    return alias === column ? ident(column) : `${ident(column)} as ${ident(alias)}`
  }).join(', ')
}

export function createPsqlRest(url, { maxRows = null } = {}) {
  const run = (statement) => {
    try {
      const out = execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], {
        input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
      return { out, error: null }
    } catch (e) {
      const message = String(e.stderr ?? e.message).replace(/^ERROR:\s*/m, '').split('\n')[0]
      return { out: null, error: { message, code: 'psql' } }
    }
  }

  return {
    /** Every statement this client rendered, for a probe that asserts the shape. */
    statements: [],
    /** A function call with named arguments, as PostgREST's `/rpc` makes it: an object argument is
     *  jsonb, anything else a literal the function's own parameter type reads. The function runs as
     *  the cluster's owner here, which is a superset of the service role the app calls it with. */
    rpc(fn, args = {}) {
      const params = Object.entries(args).map(([k, v]) =>
        `${ident(k)} => ${v !== null && typeof v === 'object' ? `${literal(JSON.stringify(v))}::jsonb` : literal(v)}`)
      const statement = `select coalesce(to_json(r), 'null'::json) from ${ident(fn)}(${params.join(', ')}) r;`
      this.statements.push(statement)
      const { out, error } = run(statement)
      return Promise.resolve(error ? { data: null, error } : { data: JSON.parse(out), error: null })
    },
    from(table) {
      const self = this
      const where = []
      const order = []
      let limit = null
      let offset = null
      let columns = '*'
      let count = false
      let head = false
      let single = null
      const q = {
        select(list, options = {}) { columns = columnsOf(list); count = options.count === 'exact'; head = !!options.head; return q },
        eq(c, v) { where.push(`${ident(c)} = ${literal(v)}`); return q },
        neq(c, v) { where.push(`${ident(c)} <> ${literal(v)}`); return q },
        gt(c, v) { where.push(`${ident(c)} > ${literal(v)}`); return q },
        gte(c, v) { where.push(`${ident(c)} >= ${literal(v)}`); return q },
        lt(c, v) { where.push(`${ident(c)} < ${literal(v)}`); return q },
        lte(c, v) { where.push(`${ident(c)} <= ${literal(v)}`); return q },
        is(c, v) {
          if (v !== null && v !== true && v !== false) throw new Error('psql-rest: is() takes null or a boolean')
          where.push(`${ident(c)} is ${literal(v)}`); return q
        },
        not(c, op, v) {
          if (op !== 'is' || v !== null) throw new Error(`psql-rest: not(${op}) is not modelled`)
          where.push(`${ident(c)} is not null`); return q
        },
        in(c, values) { where.push(`${ident(c)} in (${values.length ? values.map(literal).join(', ') : 'null'})`); return q },
        order(c, opts = {}) { order.push(`${ident(c)} ${opts.ascending === false ? 'desc' : 'asc'}`); return q },
        limit(n) { limit = n; return q },
        range(from, to) { offset = from; limit = to - from + 1; return q },
        maybeSingle() { single = 'maybe'; return q },
        single() { single = 'one'; return q },
        then(resolve, reject) {
          const filter = where.length ? ` where ${where.join(' and ')}` : ''
          const capped = maxRows === null ? limit : limit === null ? maxRows : Math.min(limit, maxRows)
          const rows = `select ${columns} from ${ident(table)}${filter}` +
            (order.length ? ` order by ${order.join(', ')}` : '') +
            (capped !== null ? ` limit ${capped}` : '') + (offset !== null ? ` offset ${offset}` : '')
          const statement = `select json_build_object('rows', coalesce((select json_agg(t) from (${rows}) t), '[]'::json)` +
            (count ? `, 'count', (select count(*) from ${ident(table)}${filter})` : '') + ');'
          self.statements.push(statement)
          const { out, error } = run(statement)
          let answer
          if (error) answer = { data: null, error, count: null }
          else {
            const parsed = JSON.parse(out)
            const data = head ? null : single ? (parsed.rows[0] ?? null) : parsed.rows
            answer = single === 'one' && parsed.rows.length !== 1
              ? { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count: null }
              : { data, error: null, count: count ? Number(parsed.count) : null }
          }
          return Promise.resolve(answer).then(resolve, reject)
        }
      }
      return q
    }
  }
}
