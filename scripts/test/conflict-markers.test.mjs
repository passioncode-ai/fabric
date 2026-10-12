import assert from 'node:assert/strict'
import test from 'node:test'
import { conflictBlocks } from '../lib/conflict-markers.mjs'

const M = (n, c) => c.repeat(n)

test('a block git writes is found, with its three lines', () => {
  const text = ['a', M(7, '<') + ' HEAD', 'ours', M(7, '='), 'theirs', M(7, '>') + ' origin/main', 'b'].join('\n')
  assert.deepEqual(conflictBlocks(text), [[2, 4, 6]])
})

test('prose, table rules and longer runs are not markers', () => {
  const text = ['use <<<<<<< in a sentence', '| --- | --- |', M(8, '='), M(7, '<') + 'x', '======= ok'].join('\n')
  assert.deepEqual(conflictBlocks(text), [])
})

test('a lone opening marker with no rest is not a block', () => {
  assert.deepEqual(conflictBlocks([M(7, '<') + ' HEAD', 'text'].join('\n')), [])
})
