// ADR-0195 W2a.4: the board's cycle composed in `main/boardCycle.ts`, given what is the window's by `main/index.ts`.
// Plan: docs/evidence/plans/2026-11-17-board-apart-waves.md §3. The cycle cannot start without a store, a journal and
// the window's terminals, so its wiring is pinned by source, as startup-wait.test.mjs does; each part it composes is
// driven for real in its own test (board-dispatch-run, people-ask-run, abandoned-sweep-run, ops-digest-send, routine-tick).
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(path.resolve(import.meta.dirname, '../src/main', f), 'utf8')
const cycle = read('boardCycle.ts')
const index = read('index.ts')

test('every timer the cycle starts is stopped at quit, and none runs while quitting', () => {
  const timers = [...cycle.matchAll(/const (\w+) = setInterval\(/g)].map((m) => m[1])
  assert.deepEqual(timers.sort(), ['dispatchWatch', 'peopleWatch', 'ticker'])
  for (const t of timers) assert.match(cycle, new RegExp(`quit\\.onQuit\\(\\(\\) => clearInterval\\(${t}\\)\\)`), `${t} is cleared at quit`)
  for (const m of cycle.matchAll(/setInterval\(\(\) => \{([^}]*)/g)) assert.match(m[1], /quit\.quitting/, 'a pass is not started once quitting')
  assert.match(cycle, /quit\.onQuit\(\(\) => \{ void dispatcher\.close\(\) \}\)/)
  assert.match(cycle, /quit\.onQuit\(\(\) => \{ void digestObservatory\.close\(\) \}\)/)
})

test('the cycle reaches no window: no Electron, no IPC door, no window state', () => {
  assert.doesNotMatch(cycle, /from 'electron'/)
  for (const name of ['callDoor', 'IPC.', 'hubReady', 'mainWindow', 'app.getPath', 'powerMonitor']) assert.ok(!cycle.includes(name), `boardCycle.ts reads ${name}`)
})

test('the window starts the cycle once, from registerIpc, with every door an answer is applied through and its clock', () => {
  assert.equal(index.split('startBoardCycle({').length - 1, 1)
  const reg = index.slice(index.indexOf('function registerIpc('))
  assert.ok(reg.includes('startBoardCycle({'), 'inside registerIpc')
  const call = reg.slice(reg.indexOf('startBoardCycle({'), reg.indexOf('onRuns: (r) => { runs = r }'))
  for (const door of ['answerQuestion', 'decideReview', 'decideProposal', 'grant', 'admitAccess', 'decideAccess']) assert.match(call, new RegExp(`\\b${door}: `), `decisions.${door}`)
  assert.match(call, /clock: \{ hostWindow, suspendedSince: \(from\) => suspendedSince\(suspendedIntervals, suspendedAt, from, Date\.now\(\)\) \}/)
  assert.match(call, /personItems\(\)/)
})
