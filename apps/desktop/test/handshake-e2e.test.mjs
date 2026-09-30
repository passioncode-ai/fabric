// CO-093 — the handshake against the REAL Claude Code CLI, over a real PTY.
//
// SEC-REQ-010 made the session credential a one-initialize handshake: after the
// first initialize, every request must also carry the mcp-session-id the
// transport returned. That is proved against the @modelcontextprotocol/sdk
// client Claude Code is built on, and required by the MCP spec — neither of
// which is the same as watching the shipped binary do it.
//
// The first attempt used execFileSync, which gives the child NO TTY, and the CLI
// never opened a connection at all. PtyManager spawns through node-pty; this
// suite reproduces the real path — same bundle, same args, same pseudo-terminal.
//
// Written as a plain module rather than a script inside a template literal: the
// sibling suites use that wrapper, and it cost this file two syntax errors,
// because every backtick in a comment closes the template. Nothing here needs it.
//
// OPT-IN — it spawns a real agent, which needs a logged-in CLI and costs a model
// call, so `pnpm test` does not run it:
//
//   FABRIC_E2E=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node apps/desktop/test/handshake-e2e.test.mjs
//
// It taps the surface, so it reports what the client actually SENT even when the
// agent's answer is unhelpful. A run that proves nothing must say so rather than
// fail in a way that reads like a broken handshake.

import { AgentSurface } from '../src/main/agentSurface.ts'
import { createDesktopJournal } from '../src/main/desktopIngress.ts'
import { createBundleCompiler } from '../src/main/sessionBundle.ts'
import { compileContextPack } from '../src/main/contextPack.ts'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node-pty'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

console.log('handshake e2e: the real CLI, over a real PTY (CO-093)')
if (!process.env.FABRIC_E2E) {
  console.log('  skipped — set FABRIC_E2E=1 to run (spawns a real agent)')
  process.exit(0)
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
// The estate this suite writes into. NOT org #1 — that is the OPERATOR'S estate,
// and every suite that used it left its fixtures in the real project list, on the
// real home screen, recreated on every test run. A test that pollutes the
// product it is testing has to be cleaned up by hand forever.
const ESTATE = randomUUID()
const projectId = randomUUID()
const sessionId = randomUUID()
const MARKER = 'handshake-' + randomUUID().slice(0, 8)

await journal.append({
  estateId: ESTATE,
  type: 'project.created@1',
  actor: { kind: 'system', id: 'handshake-e2e' },
  projectId,
  payload: { id: projectId, name: MARKER }
})

// A fact only the context pack could tell the agent — it is not in the project
// name, not in the prompt, and the agent is never told to search for it.
const PACK_SECRET = `the deploy key rotates every ${randomUUID().slice(0, 6)} days`
await journal.append({
  estateId: ESTATE,
  type: 'memory.project.recorded@1',
  actor: { kind: 'person', id: 'operator' },
  projectId,
  payload: { id: randomUUID(), claim: PACK_SECRET, source_ref: 'RUNBOOK.md' }
})

const surface = new AgentSurface({
  db,
  journal: createDesktopJournal(journal),
  ptys: () => ({ list: () => [] }),
  estateId: ESTATE
})
await surface.start()

// Tap every request, so the run reports what the client sent and not only
// whether the agent answered. Without this a failure is unattributable.
const seen = []
const original = Object.getPrototypeOf(surface).handle
Object.defineProperty(surface, 'handle', {
  value: async function (req, res) {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    const sid = req.headers['mcp-session-id'] ?? '(none)'
    res.on('finish', () => {
      let rpc = '(non-JSON-RPC)'
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        rpc = (Array.isArray(parsed) ? parsed[0]?.method : parsed?.method) ?? '(non-JSON-RPC)'
      } catch {
        /* a GET carries no body */
      }
      seen.push({ rpc, sid, status: res.statusCode })
    })
    return original.call(this, req, res)
  }
})

const root = mkdtempSync(path.join(tmpdir(), 'fabric-handshake-'))
const bundles = createBundleCompiler({
  root,
  surface,
  // The real wiring: compile, journal the lockfile, hand back the text (M49).
  context: async (sid, pid, tid) => {
    const pack = await compileContextPack({ db, projectId: pid })
    await journal.append({
      estateId: ESTATE,
      type: 'context.compiled@1',
      actor: { kind: 'system', id: 'context-pack' },
      projectId: pid,
      payload: {
        session_id: sid, task_id: tid, sha256: pack.sha256, chars: pack.chars,
        fact_ids: pack.factIds, fact_seqs: pack.factSeqs,
        transcript_ids: pack.transcriptIds,
        omitted_facts: pack.omittedFacts, omitted_transcripts: pack.omittedTranscripts
      }
    })
    return pack.markdown
  }
})
const bundle = await bundles.compile(sessionId, projectId, null)

let out = ''
const exit = await new Promise((resolve) => {
  const pty = spawn(
    'claude',
    [
      ...bundle.args,
      '-p',
      'Call fabric_whoami once. It names a context pack file in this directory. Read that file, then reply with ONLY the sentence in it about the deploy key.'
    ],
    { name: 'xterm-256color', cols: 120, rows: 32, cwd: root, env: { ...process.env } }
  )
  const timer = setTimeout(() => {
    try {
      pty.kill()
    } catch {
      /* already gone */
    }
    resolve('timeout')
  }, 180_000)
  pty.onData((d) => {
    out += d
  })
  pty.onExit(({ exitCode }) => {
    clearTimeout(timer)
    resolve(exitCode)
  })
})

console.log('--- what the CLI sent to the surface ---')
if (seen.length === 0) console.log('  (nothing — the CLI never opened a connection)')
for (const r of seen) console.log(`  rpc=${r.rpc.padEnd(24)} mcp-session-id=${r.sid} -> ${r.status}`)

console.log('--- agent output (tail) ---')
console.log(
  out
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .trim()
    .slice(-300)
)

// Order matters, and getting it wrong is how a working product reads as a broken
// one: the CLI sends a discovery probe BEFORE initialize, so filtering by method
// name instead of by position counts a pre-handshake request as a post-handshake
// refusal. Slice at the handshake.
const initIdx = seen.findIndex((r) => r.rpc === 'initialize')
const init = initIdx >= 0 ? seen[initIdx] : null
const preInit = seen.slice(0, Math.max(0, initIdx))
const tail = seen.slice(initIdx + 1)
const streams = tail.filter((r) => r.rpc === '(non-JSON-RPC)')
const afterInit = tail.filter((r) => r.rpc !== '(non-JSON-RPC)')
const echoed = afterInit.filter((r) => r.sid !== '(none)')
const refused = afterInit.filter((r) => r.status === 401)

console.log('--- before the handshake, and beside it (informational) ---')
for (const r of preInit)
  console.log(`  ${r.rpc} -> ${r.status}: sent before initialize; the CLI proceeds regardless`)
if (streams.length)
  console.log(
    `  ${streams.length} GET stream attempt(s) -> 404: this surface answers JSON on the POST`
  )

const done = async (code, ...lines) => {
  console.log('--- verdict ---')
  for (const l of lines) console.log(l)
  await surface.stop()
  process.exit(code)
}

if (seen.length === 0)
  await done(
    2,
    'INCONCLUSIVE: the CLI never reached the surface — nothing is proved either way.',
    `CO-093 stays open. cli exit=${exit}`
  )
if (!init || init.status !== 200)
  await done(1, `FAIL: the CLI could not complete initialize (status ${init?.status ?? 'none'})`)
if (afterInit.length === 0)
  await done(
    2,
    'INCONCLUSIVE: initialize succeeded but the CLI made no further call, so the',
    'session-id requirement was never exercised. CO-093 stays open.'
  )
if (refused.length > 0)
  await done(
    1,
    `FAIL: ${refused.length} post-initialize call(s) refused 401 — the shipped CLI does`,
    'not satisfy the handshake. SEC-REQ-010 must be reworked BEFORE a real session runs.'
  )
if (echoed.length !== afterInit.length)
  await done(
    1,
    `FAIL: ${afterInit.length - echoed.length} post-initialize call(s) carried no mcp-session-id.`
  )

await done(
  0,
  'PASS: the shipped Claude Code CLI completes the handshake and echoes mcp-session-id',
  `      on all ${afterInit.length} subsequent call(s): ${afterInit.map((r) => r.rpc).join(', ')}`,
  out.includes(PACK_SECRET.slice(-20))
    ? `      And the CONTEXT PACK reached the model: the agent returned a fact that exists\n      only in the pack Fabric compiled for it (M49).`
    : `      NOTE: the pack's fact did not come back; the transport is proved, the pack path is not.`
)
