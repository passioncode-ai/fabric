// A tool count in prose is found in words and in digits (audit 2026-10-05 A7-040).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolCountsInProse } from '../lib/tool-counts.mjs'

test('a count in words is found, as before', () => {
  assert.deepEqual(toolCountsInProse('intro\n- **Per-tool call counts.** Sixteen tools, eleven of which journal.'), [{ line: 2, count: 'Sixteen tools' }])
})

test('a count in digits is found — the architecture documents wrote theirs that way', () => {
  assert.deepEqual(toolCountsInProse('| Agent tool surface | **17 tools**, including claim |'), [{ line: 1, count: '17 tools' }])
  assert.deepEqual(toolCountsInProse('| T1 | 17 tools, namespaced `fabric_*`. |'), [{ line: 1, count: '17 tools' }])
  assert.deepEqual(toolCountsInProse('the surface has 27 MCP tools'), [{ line: 1, count: '27 MCP tools' }])
})

test('a threshold, a comment and a line about something else are not counts of ours', () => {
  assert.deepEqual(toolCountsInProse('pricing applies to "25+ tools or any webhook"'), [])
  assert.deepEqual(toolCountsInProse('// the old string said Sixteen tools'), [])
  assert.deepEqual(toolCountsInProse('perhaps 150 lines of code'), [])
  assert.deepEqual(toolCountsInProse("This is `agent-orchestrator`'s §2 tool-calling loop"), [], 'a section number before a compound word')
  assert.deepEqual(toolCountsInProse('Render the figure from `surfaceTools.ts`.'), [])
})
