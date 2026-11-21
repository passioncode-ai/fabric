// ADR-0201 §3, CV-REQ-03: a canvas is kept on disk and opens again with what it held; a file that is not a canvas, one
// too large, or an id that is not a file name is refused.
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, chmodSync, rmSync } from 'node:fs'

const { createCanvasStore, isScene, MAX_CANVAS_BYTES } = await import(path.resolve(import.meta.dirname, '../src/main/canvasStore.ts'))

const scene = (elements = []) => JSON.stringify({ type: 'excalidraw', version: 2, source: 'fabric', elements, appState: {}, files: {} })
const fresh = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'canvas-store-')), 'canvases')

test('a canvas never written opens empty; one written opens again with what it held', () => {
  const dir = fresh()
  const store = createCanvasStore(dir, () => 42)
  assert.deepEqual(store.read('main'), { ok: true, id: 'main', scene: null, savedAt: null })
  const text = scene([{ id: 'a', type: 'rectangle' }])
  assert.deepEqual(store.write('main', text), { ok: true, savedAt: 42 })
  const back = store.read('main')
  assert.equal(back.ok, true)
  assert.equal(back.scene, text)
  assert.equal(statSync(store.fileOf('main')).mode & 0o777, 0o600, 'readable by the owner alone')
  assert.deepEqual(readdirSync(dir), ['main.excalidraw'], 'no temporary file left behind')
  assert.deepEqual(store.list().map((c) => c.id), ['main'])
})

test('an id that is not a file name is refused before the disk is touched', () => {
  const dir = fresh()
  const store = createCanvasStore(dir)
  for (const id of ['../escape', 'a/b', '', 'UP', null]) {
    assert.equal(store.read(id).reason, 'bad-id')
    assert.equal(store.write(id, scene()).reason, 'bad-id')
  }
  assert.equal(store.list().length, 0)
})

test('a write that is not a scene, or too large, is refused and leaves the canvas as it was', () => {
  const dir = fresh()
  const store = createCanvasStore(dir)
  store.write('main', scene([{ id: 'kept' }]))
  assert.equal(store.write('main', '{"type":"other","elements":[]}').reason, 'not-a-canvas')
  assert.equal(store.write('main', 'not json').reason, 'not-a-canvas')
  assert.equal(store.write('main', { type: 'excalidraw', elements: [] }).reason, 'not-a-canvas', 'a scene arrives as text')
  const big = JSON.stringify({ type: 'excalidraw', elements: [], pad: 'x'.repeat(MAX_CANVAS_BYTES) })
  assert.equal(store.write('main', big).reason, 'too-large')
  assert.match(store.read('main').scene, /kept/)
})

test('a file that is not a canvas reads as such and is not touched', () => {
  const dir = fresh()
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'main.excalidraw'), 'hello')
  const store = createCanvasStore(dir)
  assert.equal(store.read('main').reason, 'not-a-canvas')
  assert.equal(readFileSync(path.join(dir, 'main.excalidraw'), 'utf8'), 'hello')
})

test('a folder that cannot be written is said as unwritable, with no temporary file left', { skip: process.getuid?.() === 0 }, () => {
  const dir = fresh()
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o500)
  try {
    const r = createCanvasStore(dir).write('main', scene())
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'unwritable')
    assert.equal(r.detail, 'EACCES')
  } finally {
    chmodSync(dir, 0o700)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a scene is JSON of type excalidraw with a list of elements', () => {
  assert.equal(isScene(scene()), true)
  assert.equal(isScene('{"type":"excalidraw"}'), false)
  assert.equal(isScene('{"type":"excalidraw","elements":{}}'), false)
  assert.equal(isScene(''), false)
})
