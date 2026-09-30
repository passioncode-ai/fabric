#!/usr/bin/env node
// An actor is established, never received (S09).
//
// WHY A SCRIPT AND NOT A REVIEW HABIT. The version that trusts the caller is
// shorter, works in every test, and is invisible in a diff: an IPC handler that
// takes `personId` as a parameter reads exactly like one that takes a project
// id. In a single-operator build it is even correct — there is one person. It
// becomes a privilege escalation the day a second one exists, and by then the
// parameter is at forty call sites.
//
// MEASURED AT HEAD, and it is why this can be turned on today: the actor is a
// constant (`OPERATOR_ACTOR`), so nothing has to be untangled. The gate holds
// the line from before there is anything to escalate.
//
// TWO RULES.
//
//   1. No IPC handler takes a person id, an actor or a role as a parameter.
//      Reading one from a verified context is the point; taking one off the
//      wire is the thing being refused.
//   2. `membership.ts` exports no way to build a context from a payload. The
//      absence is the design, and a helper called `fromPayload` would make the
//      unsafe path the convenient one.
//
// WHAT IT DELIBERATELY DOES NOT CHECK. The journal's `actor` field on an event
// being APPENDED is a record of who acted, written by the process that knows.
// Refusing that would refuse the audit trail. The rule is about a handler
// letting its CALLER say who the caller is.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const MAIN = 'apps/desktop/src/main'
const CONTRACT = 'apps/desktop/src/shared/membership.ts'

/** Comments blanked, offsets preserved: a gate that fires on the sentence
 *  explaining it teaches the next author to delete the explanation (S07). */
const codeOnly = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const IDENTITY = 'apps/desktop/src/shared/identity.ts'
const PORT = 'apps/desktop/src/main/identity.ts'

const problems = []
let handlers = 0

for (const file of walk(MAIN)) {
  const raw = readFileSync(file, 'utf8')
  const src = codeOnly(raw)
  const lineOf = (i) => raw.slice(0, i).split('\n').length

  // Each `handle(IPC.x, ...)` registration, up to the end of its parameter list.
  for (const m of src.matchAll(/(?<![.\w])handle\(\s*\n?\s*IPC\.(\w+),([\s\S]{0,400}?)\)\s*:/g)) {
    handlers++
    const params = m[2]
    const taken = [
      ...params.matchAll(/\b(personId|person_id|actorId|actor_id|actor|role|membershipRole)\s*[?:]/g)
    ].map((x) => x[1])
    if (taken.length)
      problems.push(
        `${file}:${lineOf(m.index)}  IPC.${m[1]} takes ${[...new Set(taken)].join(', ')} from its caller. ` +
          `A handler that lets the caller say who the caller is has no authority boundary — ` +
          `establish an ActorContext (${CONTRACT}) instead.`
      )
  }
}

const contract = readFileSync(CONTRACT, 'utf8')
for (const m of contract.matchAll(/export function (\w+)/g))
  if (/fromPayload|fromRequest|parseActor|trustActor/i.test(m[1]))
    problems.push(
      `${CONTRACT}  \`${m[1]}\` builds an actor from something a caller sent. The absence of that ` +
        `helper is the design: with it, the unsafe path is the convenient one.`
    )

// ——— 3 · a person actor is PRODUCED, never written out (FA-07)
//
// Rule 1 refuses an actor RECEIVED from a caller, which is the escalation that
// matters first. This refuses one INVENTED at a call site, which is how a second
// definition arrives — and there were three: `OPERATOR_ACTOR` in `index.ts` and
// the same object written out twice in `pty.ts`, with nothing forbidding a
// fourth. A literal is not a privilege escalation; it is how the identity of the
// person acting comes to have more than one answer.
for (const file of [...walk(MAIN), ...walk('apps/desktop/src/shared')]) {
  if (file.endsWith(IDENTITY.split('/').pop()) || file.endsWith('.test.ts')) continue
  const raw = readFileSync(file, 'utf8')
  const src = codeOnly(raw)
  const lineOf = (i) => raw.slice(0, i).split('\n').length
  // The CONSTRUCTION shape, not the type. `{ kind: 'person'; id: string }` in a
  // type position is a declaration and `{ kind: 'person', ref: … }` is an origin;
  // only `{ kind: 'person', id: … }` is an actor being made. The first version of
  // this rule matched the bare `kind: 'person'` and fired on eight type
  // annotations — a gate that cries about its own vocabulary teaches people to
  // silence it.
  for (const m of src.matchAll(/kind:\s*'person'(\s+as const)?\s*,\s*id\s*:/g)) {
    // `actorOf` in the contract is the producer; the port hands its result on.
    if (file.endsWith('identity.ts')) continue
    problems.push(
      `${file}:${lineOf(m.index)}  writes a person actor by hand. It comes from ` +
        `${PORT}, which resolves a membership — a literal here is a second answer to ` +
        `"who is acting", and there were three of them before this rule existed.`
    )
  }
}

if (problems.length) {
  console.error(`actor: ${problems.length} place(s) where the caller could say who it is\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `actor: ${handlers} IPC registration(s), none taking an identity from its caller; ` +
    `no helper builds an actor from a payload`
)
