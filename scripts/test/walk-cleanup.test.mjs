// scripts/walk/cleanup.mjs: a walk waits for the app it started to exit and removes its temp folders
// (release review 2026-10-03, iteration 2, finding 8). Real processes and real folders; no app, no stack.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { endApp, removeTemp } from '../walk/cleanup.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const ready = (child) => new Promise((resolve) => child.stdout.once('data', resolve))

test('endApp resolves only once the app has exited after SIGTERM, and calls a clean exit terminated', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => process.exit(0)); console.log("up"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  await ready(child)
  assert.equal(await endApp(child, { graceMs: 5000 }), 'terminated')
  assert.equal(alive(child.pid), false, 'the app was still running when the walk moved on')
})

// CO-191: "gone" is not "quit". A process ended by the signal's default action did not run its shutdown.
test('an app ended by the signal itself is reported signalled, not terminated', async () => {
  const child = spawn(process.execPath, ['-e', 'console.log("up"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  await ready(child)
  assert.equal(await endApp(child, { graceMs: 5000 }), 'signalled')
})

// The morning fix signalled the whole group, so a forwarding wrapper delivered SIGTERM twice. The app
// must receive exactly one.
test('the app receives SIGTERM exactly once, even when it is a group leader', async () => {
  const script = 'let n=0;process.on("SIGTERM",()=>{n++;setTimeout(()=>{console.log("COUNT "+n);process.exit(0)},300)});console.log("up");setInterval(()=>{},1000)'
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'], detached: true })
  await ready(child)
  let out = ''
  child.stdout.on('data', (d) => { out += d })
  assert.equal(await endApp(child, { graceMs: 5000 }), 'terminated')
  assert.match(out, /COUNT 1\b/)
})

test('an app that ignores SIGTERM is killed after the grace period, and still waited for', async () => {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); console.log("up"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  await ready(child)
  const started = Date.now()
  assert.equal(await endApp(child, { graceMs: 300 }), 'killed')
  assert.ok(Date.now() - started >= 250, 'it did not give the app its grace period')
  assert.equal(alive(child.pid), false)
})

test('the walk\'s fixture and user-data folders are removed, and the walk script uses both helpers', () => {
  const fx = mkdtempSync(path.join(tmpdir(), 'fabric-walk-fx-'))
  const ud = mkdtempSync(path.join(tmpdir(), 'fabric-walk-ud-'))
  writeFileSync(path.join(fx, 'file'), 'x')
  assert.deepEqual(removeTemp([fx, ud], { log: () => {} }), [])
  assert.equal(existsSync(fx) || existsSync(ud), false, 'a temp folder outlived the walk')
  const walk = readFileSync(path.resolve(import.meta.dirname, '../walk/start-paths.mjs'), 'utf8')
  assert.match(walk, /await endApp\(child/, 'start-paths.mjs still exits without waiting for the app')
  assert.match(walk, /removeTemp\(\[fx, userData\]/, 'start-paths.mjs still leaves its temp folders behind')
})

// Twenty orphaned app copies were left in the operator's Dock on 2026-10-03. Whatever the app started is
// reaped once the app itself has exited: it runs in its own group and the group is killed afterwards.
test('a grandchild the app process started is ended too, not orphaned', async () => {
  const script = 'const c=require("child_process").spawn(process.execPath,["-e","process.on(\\"SIGTERM\\",()=>{});setInterval(()=>{},1000)"],{stdio:"ignore"});console.log("GRAND "+c.pid);setInterval(()=>{},1000)'
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'], detached: true })
  const line = await new Promise((resolve) => child.stdout.once('data', (d) => resolve(String(d))))
  const grand = Number(/GRAND (\d+)/.exec(line)?.[1])
  assert.ok(grand > 0)
  await endApp(child, { graceMs: 500 })
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(alive(grand), false, 'the real app outlived the wrapper the walk ended')
})
test('the walk spawns the Electron binary in its own process group, and fails on an app that did not quit', () => {
  const walk = readFileSync(path.resolve(import.meta.dirname, '../walk/start-paths.mjs'), 'utf8')
  assert.match(walk, /detached: true/, 'start-paths.mjs spawns the app outside its own process group')
  assert.doesNotMatch(walk, /node_modules\/\.bin\/electron'\)/, 'start-paths.mjs spawns the forwarding wrapper, which doubles SIGTERM')
  assert.match(walk, /createRequire\(path\.join\(APP, 'package\.json'\)\)\('electron'\)/)
  assert.match(walk, /ok: ended === 'terminated'/, 'the walk passes an app that had to be killed')
  assert.match(walk, /FABRIC_NO_KEYCHAIN: '1'/, 'the walk lets the app read the operator\'s real Keychain')
  assert.match(walk, /'--use-mock-keychain'/)
  assert.match(walk, /CLAUDE_CONFIG_DIR: path\.join\(userData/, 'the walk lets the app read the real Claude config home')
  assert.ok(walk.indexOf("name: 'app-quits-gracefully'") < walk.indexOf("writeFileSync(path.join(OUT, 'walk.json')"), 'walk.json is written before the quit verdict')
})
