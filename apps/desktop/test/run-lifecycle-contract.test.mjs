// The run lifecycle's refusals are the ones the SQL can return (release review 2026-10-03, data finding 5).
//
// `run-lifecycle.test.mjs` expected `bind_task_run` to refuse a second session
// with `already_bound` — migration 55's word. Migration 61 replaced the
// function for the managed launch (HAR-R0-03: "exact bind", one coordinator),
// and from then on a second session on a launching or active run is
// `session_conflict`; `managed-launch-db.test.mjs` asserts exactly that on an
// owned cluster. The HTTP-backed probe kept the old word, so the full tier was
// red on it while nothing that runs offline could say so.
//
// This holds the three in step without a database: the refusal vocabulary
// `runLifecycle.ts` declares is the one the LATEST definition of each command
// returns, and every reason any lifecycle probe compares against is in it.
// Pure: reads source files only.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { BIND_REFUSALS, END_REFUSALS } from '../src/main/runLifecycle.ts'

const migrations = new URL('../../../supabase/migrations/', import.meta.url)
/** The body of the last migration that (re)defines `name`. */
const latest = (name) => {
  let body = null
  for (const f of readdirSync(migrations).filter((x) => x.endsWith('.sql')).sort()) {
    const text = readFileSync(new URL(f, migrations), 'utf8')
    const at = text.search(new RegExp(`create (or replace )?function ${name}\\(`))
    if (at < 0) continue
    const start = text.indexOf('$$', at)
    body = { file: f, text: text.slice(start, text.indexOf('$$', start + 2)) }
  }
  if (!body) throw new Error(`${name} is defined by no migration`)
  return body
}
/** Literal reason codes, plus `'reason_code',r.state` resolved through its own `r.state in (…)` guard. */
const reasons = ({ text }) => {
  const codes = new Set([...text.matchAll(/'reason_code'\s*,\s*'([a-z_]+)'/g)].map((m) => m[1]))
  for (const m of text.matchAll(/r\.state in \(([^)]*)\) then return jsonb_build_object\('bound',false,'reason_code',r\.state\)/g))
    for (const s of m[1].matchAll(/'([a-z_]+)'/g)) codes.add(s[1])
  return codes
}

let failures = 0
const test = (name, fn) => {
  try { fn(); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + e.message.split('\n').join('\n       ')) }
}

const bind = latest('bind_task_run'), end = latest('end_task_run')

test(`the bind refusals runLifecycle.ts declares are exactly what ${bind.file} returns`, () => {
  assert.deepEqual([...BIND_REFUSALS].sort(), [...reasons(bind)].sort())
})
test(`the end refusals runLifecycle.ts declares are exactly what ${end.file} returns`, () => {
  assert.deepEqual([...END_REFUSALS].sort(), [...reasons(end)].sort())
})
test('every reason a lifecycle probe expects is one the commands can return', () => {
  const known = new Set([...BIND_REFUSALS, ...END_REFUSALS, 'unavailable'])
  const unknown = []
  for (const probe of ['run-lifecycle.test.mjs', 'managed-launch-db.test.mjs']) {
    const text = readFileSync(new URL(`./${probe}`, import.meta.url), 'utf8')
    const expected = [
      ...[...text.matchAll(/reasonCode === '([a-z_]+)'/g)].map((m) => m[1]),
      ...[...text.matchAll(/bind\([^)]*\)\.reason_code,\s*'([a-z_]+)'/g)].map((m) => m[1])
    ]
    assert.ok(expected.length > 0, `${probe}: no expected reason found — the extraction is broken`)
    for (const code of expected) if (!known.has(code)) unknown.push(`${probe} expects '${code}'`)
  }
  assert.deepEqual(unknown, [], 'a probe expects a reason no command returns')
})

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1) }
console.log('\nall green: the lifecycle module, its probes and the SQL name the same refusals')
