// Whether a Claude Code session took a turn from the person, from its own transcript (2026-11-20, 0daa75f1 and
// e150fe59: the first task was dropped and only the transcript could tell). An unread transcript is an unknown.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { claudeTranscriptPaths, claudeTurnTaken, hasPersonTurn } from '../src/main/claudeTranscript.ts'

test('the transcript of a folder is found in each home, the folder named as Claude Code names it', () => {
  const p = claudeTranscriptPaths('/work/sound-engine', 'abc', { CLAUDE_CONFIG_DIR: '/h/iso' }, '/h/me')
  assert.deepEqual(p, ['/h/iso/projects/-work-sound-engine/abc.jsonl', '/h/me/.claude/projects/-work-sound-engine/abc.jsonl'])
})

test('hooks alone are no turn; a line from the person is; a missing file is unknown', async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'cc-'))
  const dir = path.join(home, '.claude', 'projects', '-work-x')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 's1.jsonl')
  const hooks = '{"type":"attachment","attachment":{"type":"hook_success"}}\n{"type":"file-history-snapshot"}\n'
  writeFileSync(file, hooks)
  assert.equal(hasPersonTurn(hooks), false)
  assert.equal(await claudeTurnTaken('/work/x', 's1', claudeTranscriptPaths('/work/x', 's1', {}, home)), false)
  writeFileSync(file, hooks + '{"type":"user","message":{"role":"user","content":"Do it"}}\n')
  assert.equal(await claudeTurnTaken('/work/x', 's1', claudeTranscriptPaths('/work/x', 's1', {}, home)), true)
  assert.equal(await claudeTurnTaken('/work/x', 'other', claudeTranscriptPaths('/work/x', 'other', {}, home)), null)
})

test('run four: a meta line or tool results alone are no turn; Claude Code taking the message into its queue is one', () => {
  const meta = '{"type":"user","isMeta":true,"message":{"role":"user","content":"Another Claude session sent a message"}}\n'
  const tool = '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"ok"}]}}\n'
  assert.equal(hasPersonTurn(meta), false)
  assert.equal(hasPersonTurn(tool), false)
  assert.equal(hasPersonTurn(meta + '{"type":"queue-operation","operation":"dequeue"}\n'), true)
  assert.equal(hasPersonTurn(meta + '{"type":"queue-operation","operation":"remove"}\n'), false)
  assert.equal(hasPersonTurn(meta + '{"type":"user","message":{"role":"user","content":"Do it"}}\n'), true)
  assert.equal(hasPersonTurn('{"type":"user","message":{"content":"cut'), false, 'a cut last line is not a turn')
})
