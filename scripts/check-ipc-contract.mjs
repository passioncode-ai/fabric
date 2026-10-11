#!/usr/bin/env node
// Every IPC handler is compared against the one declaration of its answer (M109).
//
// The renderer's `FabricApi` is where a channel's answer is declared, and until
// `Returns<>` existed nothing connected a handler to it: `tsc` type-checked the
// preload calls and compared them with NOTHING. Three drifts were found the
// first time anybody looked, and a fourth the moment the sweep ran —
// `tasks.start` promised the renderer a whole `TerminalSession` while the main
// process sent `{ sessionId }`. Reading `session.cwd` would have compiled and
// been undefined.
//
// The annotation is the check; this is what makes handler seventy-nine carry
// it. A sweep closes today's gap and a gate closes tomorrow's.
//
// COVERAGE, MEASURED 2026-09-11 (UXA-C02): 88 of 88 `handle(IPC.*)` calls in
// `apps/desktop/src/main/index.ts`. It used to be 87, and the gate said "87
// handlers, each checked" without ever saying 87 of what. The regex below
// required a parameter list after the channel, so a handler passed BY NAME —
// `handle(IPC.attentionList, readAttention)` — matched nothing and was counted
// nowhere. One handler in eighty-eight was written that way, and it was the one
// whose answer dropped its source receipts on the floor. A fence that reports
// its catch without reporting its reach cannot be told apart from a fence with
// a hole in it.

import { readFileSync } from 'node:fs'
import { stripComments } from './lib/strip-comments.mjs'
import { IPC } from '../apps/desktop/src/shared/types.ts'
import { CHANNEL_RULES, WINDOW_KINDS } from '../apps/desktop/src/shared/ipcWindowPolicy.ts'

const FILE = 'apps/desktop/src/main/index.ts'
/** Channels main BROADCASTS; they have no handler and no declared answer. */
const BROADCAST = new Set(['projectsRepoChanged', 'terminalData', 'terminalExit'])

// COMMENTS FIRST. This gate used to scan raw source, so a doc comment quoting
// the shape it refuses was read as that shape — measured on the very change
// that closed the hole below (UXA-C02). Line numbering survives the blanking,
// so a real finding still points at a real line.
const src = stripComments(readFileSync(FILE, 'utf8'))
const problems = []
let checked = 0

// EVERY `handle(IPC.*)` call, whatever shape its second argument takes. The
// previous pattern demanded `(` after the channel and therefore enumerated only
// the handlers written as inline callbacks — so a handler passed by name was
// not failed, it was never seen.
const head = /handle\(\s*\n?\s*IPC\.(\w+),\s*/g
const ANNOTATED = /^\s*:\s*(?:Promise<)?Returns<FabricApi\[/
for (let m = head.exec(src); m; m = head.exec(src)) {
  if (BROADCAST.has(m[1])) continue
  checked++
  const start = m.index + m[0].length
  const rest = src.slice(start)
  const line = src.slice(0, m.index).split('\n').length
  // A handler passed BY NAME has no parameter list to annotate, so the one
  // declaration of its answer is compared against nothing. Named here rather
  // than skipped: an unannotatable shape is the gap, not an exemption.
  if (!/^(?:async\s*)?\(/.test(rest)) {
    const named = /^([\w.]+)/.exec(rest)?.[1] ?? 'that expression'
    problems.push(
      `${FILE}:${line}  IPC.${m[1]} is handled by \`${named}\`, passed by name — there is no callback to annotate, ` +
        `so nothing compares its answer to what the renderer was promised`
    )
    continue
  }
  // Walk to the end of the parameter list, then look at what follows.
  let i = start + /^(?:async\s*)?\(/.exec(rest)[0].length
  let depth = 1
  while (depth > 0 && i < src.length) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') depth--
    i++
  }
  if (!ANNOTATED.test(src.slice(i, i + 200)))
    problems.push(
      `${FILE}:${line}  IPC.${m[1]} does not declare Returns<FabricApi[…]> — nothing compares it to what the renderer was promised`
    )
}

// WHO MAY CALL IT (CO-091, REQ-31). A channel is open to the window kinds its rule names and to no
// other, so a channel with no rule is a channel nobody can call — and a channel somebody forgot. The
// mapped type in `ipcWindowPolicy.ts` already makes a missing key a compile error; this says so in
// the gate's own words, and also refuses an EMPTY rule, which the type allows.
const kindProblems = []
for (const key of Object.keys(IPC)) {
  const rule = CHANNEL_RULES[key]
  const kinds = rule ? Object.keys(rule) : []
  if (!kinds.length) kindProblems.push(`IPC.${key} declares no window kind in CHANNEL_RULES — default deny: no window can call it`)
  for (const k of kinds) if (!WINDOW_KINDS.includes(k)) kindProblems.push(`IPC.${key} names ${k}, which is no window kind`)
}
for (const key of Object.keys(CHANNEL_RULES)) if (!(key in IPC)) kindProblems.push(`CHANNEL_RULES.${key} rules a channel IPC does not declare`)
// Every window built with the preload is built with its kind: the registry is what the rule is read
// against, and the preload narrows by the same argument.
const preloads = [...src.matchAll(/preload:\s*path\.join/g)].length
const kinded = [...src.matchAll(/additionalArguments:\s*\[windowKindArg\('(?:main|session|editor)'\)\]/g)].length
const registered = [...src.matchAll(/windowKinds\.register\(/g)].length
if (kinded !== preloads) kindProblems.push(`${FILE}: ${preloads} windows carry the preload and ${kinded} are given a window kind`)
if (registered !== preloads) kindProblems.push(`${FILE}: ${preloads} windows carry the preload and ${registered} are registered with windowKinds`)
problems.push(...kindProblems)

if (problems.length) {
  console.error(`ipc: ${problems.length - kindProblems.length} of ${checked} handlers answer an unchecked contract; ${kindProblems.length} window-kind problems\n`)
  for (const p of problems) console.error('  ' + p)
  if (problems.length > kindProblems.length)
    console.error(
      `\nAnnotate the callback: \`: Promise<Returns<FabricApi['ns']['fn']>>\` for an async handler,\n` +
        `\`: Returns<FabricApi['ns']['fn']>\` for a synchronous one. The type comes from the one\n` +
        `declaration, so it cannot become a second list that drifts from it.`
    )
  if (kindProblems.length)
    console.error(
      `\nGive the channel a rule in apps/desktop/src/shared/ipcWindowPolicy.ts#CHANNEL_RULES naming the window\n` +
        `kinds that use it today, and build every preload window with windowKindArg(kind) and windowKinds.register.`
    )
  process.exit(1)
}

console.log(
  `ipc: ${checked} of ${checked} handle(IPC.*) calls checked against the answer its channel declares; ` +
    `${Object.keys(IPC).length} of ${Object.keys(IPC).length} channels declare the window kinds that may use them, ` +
    `${preloads} of ${preloads} preload windows built with their kind`
)
