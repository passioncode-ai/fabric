// CO-622 item 1: a console the CEO starts takes its model and effort as the runner's own start flags, never as text
// typed into the console (the CEO typed `/model …` and one session ran on another model than asked).
import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PtyManager } from '../src/main/pty.ts'
import { withLaunchModel, modelArgs, currentLaunchModel, MODEL_NAME } from '../src/main/launchModel.ts'

test('each runner gets its own flags; a runner without them is said as not applied', () => {
  assert.deepEqual(modelArgs('claude-code', { model: 'claude-fable-5-2', effort: 'max' }), { args: ['--model', 'claude-fable-5-2', '--effort', 'max'], unapplied: [] })
  assert.deepEqual(modelArgs('codex', { model: 'gpt-5.1-codex', effort: 'xhigh' }), { args: ['-m', 'gpt-5.1-codex', '-c', 'model_reasoning_effort="high"'], unapplied: [] })
  assert.deepEqual(modelArgs('shell', { model: 'opus', effort: 'low' }), { args: [], unapplied: ['model', 'effort'] })
  assert.deepEqual(modelArgs('claude-code', null), { args: [], unapplied: [] })
  // A name that could carry a shell or a second flag is never passed on.
  for (const bad of ['opus --dangerously-skip-permissions', 'a;rm -rf ~', '-m', '']) assert.equal(MODEL_NAME.test(bad), false, bad)
  assert.deepEqual(modelArgs('claude-code', { model: 'opus; rm' }), { args: [], unapplied: ['model'] })
})

test('the choice reaches the spawn of the console it was asked for, and no other', async () => {
  const spawned = []
  const fake = (file, args) => { spawned.push(args); const p = { pid: 4_194_305, onData() { return { dispose() {} } }, onExit() { return { dispose() {} } }, write() {}, resize() {}, kill() {} }; return p }
  const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} },
    { compile: async () => ({ dir: '/not-used', args: [] }), discard() {} }, fake,
    undefined, () => ({ kind: 'person', id: 'operator' }))
  const project = randomUUID()
  await withLaunchModel({ model: 'claude-fable-5-2', effort: 'high' }, async () => {
    assert.deepEqual(currentLaunchModel(), { model: 'claude-fable-5-2', effort: 'high' })
    await manager.open(project, process.cwd(), 'claude-code').catch(() => null)
  })
  await manager.open(project, process.cwd(), 'claude-code').catch(() => null)
  assert.equal(currentLaunchModel(), null)
  const withFlags = spawned.filter((a) => a.includes('--model'))
  assert.equal(withFlags.length, 1, `one spawn carries the model: ${JSON.stringify(spawned)}`)
  const a = withFlags[0]
  assert.equal(a[a.indexOf('--model') + 1], 'claude-fable-5-2')
  assert.equal(a[a.indexOf('--effort') + 1], 'high')
})
