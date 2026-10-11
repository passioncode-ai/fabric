// Every event type the main process writes reaches the journal (0.4.0 wave 1): the desktop journal refuses an
// event type that is neither covered by field rules (shared/commandIngress.ts#COVERED_INGRESS_EVENTS) nor named in
// EXTERNAL_INGRESS_OWNERS (main/desktopIngress.ts). The hub's tests built their store on the raw journal, so every
// access.* event of 0.3.1–0.3.4 was refused in the app ("Input was refused before persistence") and no test saw it.
// This reads the type literals the main process appends and checks each against the app's own journal policy.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const MAIN = path.resolve(import.meta.dirname, '../src/main')
const { EXTERNAL_INGRESS_OWNERS } = await import(path.join(MAIN, 'desktopIngress.ts'))
const { COVERED_INGRESS_EVENTS } = await import(path.resolve(import.meta.dirname, '../src/shared/commandIngress.ts'))

// `append('x@1', …)`, `append("x@1"`, `type: 'x@1'` in an append's envelope.
const PATTERNS = [/\.append\(\s*['"]([a-z][a-z0-9_.]*@\d+)['"]/g, /\btype:\s*['"]([a-z][a-z0-9_.]*@\d+)['"]/g]

function writtenTypes() {
  const found = new Map()
  for (const f of readdirSync(MAIN).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    const src = readFileSync(path.join(MAIN, f), 'utf8')
    for (const re of PATTERNS) for (const m of src.matchAll(re)) if (!found.has(m[1])) found.set(m[1], f)
  }
  return found
}

test('every event type the main process appends is covered or has a named owner', () => {
  const allowed = new Set([...COVERED_INGRESS_EVENTS, ...Object.keys(EXTERNAL_INGRESS_OWNERS)])
  const missing = [...writtenTypes()].filter(([type]) => !allowed.has(type)).map(([type, file]) => `${type} (${file})`)
  assert.deepEqual(missing, [], 'the desktop journal would refuse these')
})

test('the hub\'s own events are among them (the class this test exists for)', () => {
  const types = writtenTypes()
  for (const t of ['access.requested@1', 'access.decided@1', 'hub.call.forwarded@1', 'session.enrolled@1']) assert.ok(types.has(t), `${t} is written by main`)
})
