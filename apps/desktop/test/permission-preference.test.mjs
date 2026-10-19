// The machine's one permission choice (CO-305, ADR-0168): a launch that names no mode takes it, a named mode is kept,
// and a mode's environment reaches the program (Goose reads GOOSE_MODE, not a flag). Only native spawn is replaced.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PtyManager, setPermissionPreference, launchOptions } from '../src/main/pty.ts'
import { AGENTS } from '../src/shared/agents.ts'

const FAKE_PID = 4_194_305
AGENTS.push({
  ...AGENTS.find((a) => a.id === 'shell'),
  id: 'console-fixture',
  label: 'Console fixture',
  permissionModes: [
    { id: 'ask', labelKey: 'agent.mode.ask', args: [], containment: 'runner-gated', env: { FIXTURE_MODE: 'approve' } },
    { id: 'bypass', labelKey: 'agent.mode.bypass', args: ['--yolo'], containment: 'none', env: { FIXTURE_MODE: 'auto' } }
  ],
  defaultMode: 'ask'
})

async function launch(mode) {
  const events = []
  let spawned = null
  const native = { pid: FAKE_PID, resize() {}, write() {}, kill() {}, onData() {}, onExit() {} }
  const manager = new PtyManager({ append: async (e) => { events.push(e); return { seq: events.length } } }, randomUUID(),
    { onData() {}, onExit() {} }, undefined, (file, args, opts) => { spawned = { file, args, env: opts.env }; return native },
    undefined, () => ({ kind: 'person', id: 'operator' }))
  const s = await manager.open(randomUUID(), process.cwd(), 'console-fixture', null, mode)
  const opened = events.find((e) => e.type === 'terminal.opened@1')
  return { mode: manager.get(s.sessionId).permissionMode, recorded: opened.payload.permission_mode, spawned }
}

try {
  setPermissionPreference(null)
  let r = await launch(null)
  assert.equal(r.mode, 'ask', 'unwired, a launch keeps the runner\'s own default')

  setPermissionPreference(() => 'fewer-prompts')
  r = await launch(null)
  assert.equal(r.mode, 'bypass')
  assert.equal(r.recorded, 'bypass', 'the journal records the mode the runner received')
  assert.ok(r.spawned.args.includes('--yolo'), `bypass arguments reach the program: ${r.spawned.args}`)
  assert.equal(r.spawned.env.FIXTURE_MODE, 'auto', 'a mode\'s environment reaches the program')

  r = await launch('ask')
  assert.equal(r.mode, 'ask', 'a named mode is kept whatever the machine prefers')
  assert.ok(!r.spawned.args.includes('--yolo'))
  assert.equal(r.spawned.env.FIXTURE_MODE, 'approve')

  setPermissionPreference(() => 'manual')
  r = await launch(null)
  assert.equal(r.mode, 'ask')
  assert.ok(!r.spawned.args.includes('--yolo'))

  const availability = { locate: async () => '/bin/x' }
  const fewer = (await launchOptions(availability, 'fewer-prompts')).find((o) => o.id === 'console-fixture')
  assert.equal(fewer.defaultMode, 'bypass', 'a picker preselects what a launch without a choice would use')
  const manual = (await launchOptions(availability, 'manual')).find((o) => o.id === 'console-fixture')
  assert.equal(manual.defaultMode, 'ask')
  const gemini = (await launchOptions(availability, 'fewer-prompts')).find((o) => o.id === 'gemini-cli')
  assert.ok(gemini, 'a catalogue agent is a launch option')
  assert.equal(gemini.connectsToSurface, false)
} finally {
  setPermissionPreference(null)
}
console.log('PASS the machine permission choice reaches every launch that names no mode, and a mode\'s environment reaches its program')
