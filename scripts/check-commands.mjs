#!/usr/bin/env node
// An event type that has a command has exactly ONE writer (FA-04).
//
// WHY A SCRIPT. `task.linked@1` had three writers: the MCP tool, the task-create
// chain link, and the operator's research path. Only the first checked anything,
// and what it checked it checked badly — in the client, one round trip before the
// append, with the RPC's `error` destructured away. The other two wrote the same
// edge under no rules at all. Nothing looked wrong in any of the three: each is a
// short, readable append of a well-formed event.
//
// A SECOND DOOR IS A SECOND SET OF RULES. It does not start out different; it
// becomes different the first time somebody in a hurry fixes one of them. The
// rule this enforces is the cheap half — where a command exists, the direct
// append is refused at the gate rather than discovered in an audit.
//
// Tests are exempt: a probe that ATTEMPTS the forbidden write is how the
// projector's own refusal gets watched, and forbidding it here would remove the
// only evidence that the refusal works.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// event type → the command that is allowed to append it.
const COMMANDED = {
  'task.linked@1': 'link_tasks',
  // SCR-41 L3b: setting a question aside and returning it have one door each.
  'question.deferred@1': 'defer_question',
  'question.reopened@1': 'reopen_question',
  // L8 · ADR-0084: a release and its verification are recorded by a person, one door each.
  'release.recorded@1': 'record_release',
  'release.verified@1': 'verify_release'
}

const ROOTS = ['apps/desktop/src/main', 'apps/desktop/src/renderer/src', 'apps/desktop/src/shared']

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

const blank = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))

const problems = []
for (const file of ROOTS.flatMap(walk)) {
  const raw = readFileSync(file, 'utf8')
  const src = blank(raw)
  for (const [type, command] of Object.entries(COMMANDED)) {
    // The event type written as a literal in code, not in a comment explaining
    // the rule — the first version of a gate like this fired on its own
    // documentation, which teaches the next author to delete the explanation.
    for (const m of src.matchAll(new RegExp(`['"\`]${type.replace(/[.@]/g, '\\$&')}['"\`]`, 'g'))) {
      const line = raw.slice(0, m.index).split('\n').length
      problems.push(
        `${file}:${line}  appends ${type} directly. It has a command: call ` +
          `db.rpc('${command}', …), which takes the estate lock before it checks, ` +
          `so scope, topology and the append are one act.`
      )
    }
  }
}

if (problems.length) {
  console.error(`commands: ${problems.length} direct append(s) around a command\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `commands: ${Object.keys(COMMANDED).length} commanded event type(s) have one writer each ` +
    `(${Object.values(COMMANDED).join(', ')})`
)
