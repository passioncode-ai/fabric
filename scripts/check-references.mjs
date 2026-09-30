#!/usr/bin/env node
// Every reference between estate-scoped tables carries its estate (S02).
//
// MEASURED BEFORE THIS: eleven foreign keys, all single-column, pointing at the
// target's `id` alone. None asked whether the referenced row was in the same
// estate — so a row in one estate could name another's grant, goal or task, and
// the database would take it. The paths were closed by FUNCTIONS that remembered
// to filter, every one of them a caller being careful.
//
// The migration made nine of them composite. This gate is what keeps the TWELFTH
// one composite, written a year from now by somebody who never opened that file.
// It reads the scope map — the same one the runtime boundary is built from — so
// "which tables are estate-scoped" is not a second list here either.
//
// It reads the MIGRATIONS rather than a live database, so it runs in the fast
// tier with no stack. The planted-defect suite (P29) is what proves the
// constraints actually refuse; this proves none was left behind.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS = 'supabase/migrations'
const SCOPE = 'apps/desktop/src/shared/scope.ts'

/** A reference that stays single-column, and why. An exemption carries its
 *  reason or it is not one — the same rule the scope map and the ops gate keep. */
const UNQUALIFIED = {
  'memberships.person_id':
    'a person belongs to no estate; the identity plane is deliberately outside the boundary',
  'memberships.estate_id':
    'this IS the estate reference, not one that needs qualifying by an estate'
}

// The estate-scoped tables, taken from the scope map rather than listed again.
const scopeSrc = readFileSync(SCOPE, 'utf8')
const scoped = new Set(
  [...scopeSrc.matchAll(/^\s{2}([a-z_]+):\s*(ESTATE_ONLY|ESTATE_AND_PROJECT|\{)/gm)].map((m) => m[1])
)

const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8'))
  .join('\n')

const problems = []
let composite = 0
let exempt = 0

// Inline column references: `col uuid references target(id)`.
for (const m of sql.matchAll(/^\s*([a-z_]+)\s+uuid[^,\n]*\breferences\s+([a-z_]+)\s*\(/gim)) {
  const [, column, target] = m
  if (!scoped.has(target)) continue
  // Which table declares it — the nearest preceding `create table`.
  const before = sql.slice(0, m.index)
  const table = [...before.matchAll(/create table (?:if not exists )?([a-z_]+)/g)].pop()?.[1]
  if (!table || !scoped.has(table)) continue
  const key = `${table}.${column}`
  if (UNQUALIFIED[key]) {
    exempt++
    continue
  }
  // A later migration may have replaced it with a composite one. That is the
  // normal path here — the schema is append-only migrations, so the question is
  // what the LAST statement about this pair did.
  const dropped = new RegExp(`alter table ${table}\\s+drop constraint if exists ${table}_${column}_fkey`, 'i').test(sql)
  if (dropped) continue
  problems.push(
    `${table}.${column} → ${target} is referenced by id alone. Both tables are estate-scoped, so the ` +
      `database will accept a row naming another estate's row. Make it composite, or name it in ` +
      `UNQUALIFIED with the reason it belongs outside the boundary.`
  )
}

for (const m of sql.matchAll(/foreign key \(estate_id,\s*[a-z_]+\)\s*references\s+([a-z_]+)/gi)) {
  if (scoped.has(m[1])) composite++
}

if (composite === 0)
  problems.push(
    'no composite estate reference found at all. Either they were removed, or this gate is matching a ' +
      'syntax nobody writes any more — which passes forever and proves nothing.'
  )

if (problems.length) {
  console.error(`references: ${problems.length} reference(s) that can cross an estate\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `references: ${composite} composite estate reference(s), ${exempt} deliberately unqualified with a reason`
)
