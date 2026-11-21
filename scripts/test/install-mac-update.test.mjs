// The in-place update's decisions (scripts/lib/install-mac-update.mjs): what may replace what, which registrations and
// copies are stale, and how the Dock keeps one Fabric tile. The bug these pin: 0.3.26's apply moved the bundle folder,
// the Dock tile followed it, and a second Fabric icon appeared (the operator, 2026-11-20).
import assert from 'node:assert/strict'
import test from 'node:test'
import { compareVersions, dedupeDock, fabricRunning, installProblems, rollbackZip, sideCopies, staleRegistrations, stagingDir } from '../lib/install-mac-update.mjs'

const fab = (over = {}) => ({ id: 'ai.passioncode.desktop', version: '0.3.27', team: 'TEAM1', signatureOk: true, ...over })

test('versions compare by their numbers, a suffix ignored', () => {
  assert.equal(compareVersions('0.3.27', '0.3.26'), 1)
  assert.equal(compareVersions('0.3.9', '0.3.10'), -1)
  assert.equal(compareVersions('0.3.26-rc.1', '0.3.26'), 0)
})

test('a newer, signed Fabric of the same team may replace the installed one', () => {
  assert.deepEqual(installProblems({ installed: fab({ version: '0.3.26' }), incoming: fab() }), [])
  assert.deepEqual(installProblems({ installed: null, incoming: fab() }), [])
})

test('another app, a broken signature, another team, a downgrade and a reinstall are refused', () => {
  assert.match(installProblems({ installed: null, incoming: fab({ id: 'com.other' }) })[0], /bundle id is com.other/)
  assert.match(installProblems({ installed: null, incoming: fab({ signatureOk: false }) })[0], /signature/)
  assert.match(installProblems({ installed: fab({ version: '0.3.26' }), incoming: fab({ team: 'EVIL' }) })[0], /team EVIL/)
  assert.match(installProblems({ installed: fab({ version: '0.3.28' }), incoming: fab() })[0], /older/)
  assert.match(installProblems({ installed: fab(), incoming: fab() })[0], /already installed/)
  assert.match(installProblems({ installed: fab({ id: 'com.other', version: '0.1.0' }), incoming: fab() })[0], /another app/)
  assert.deepEqual(installProblems({ installed: fab({ version: '0.3.28' }), incoming: fab(), force: true }), [])
})

test('an unsigned local build replaces an unsigned one (no team on either side)', () => {
  assert.deepEqual(installProblems({ installed: fab({ version: '0.3.26', team: null }), incoming: fab({ team: null }) }), [])
})

const dump = [
  'path:                       /Applications/Fabric.app (0x1752c)\nname:                       Fabric\nidentifier:                 ai.passioncode.desktop',
  'path:                       /Applications/Fabric.app/Contents/Frameworks/Fabric Helper.app (0x17528)\nidentifier:                 ai.passioncode.desktop.helper',
  'path:                       /Applications/Fabric-0.3.20.app (0x16080)\nname:                       Fabric\nidentifier:                 ai.passioncode.desktop',
  'path:                       /Volumes/Work/rollout/Fabric-0.3.24.app (0x17544)\nidentifier:                 ai.passioncode.desktop',
  'path:                       /Applications/Fabric Dashboards.app (0x173f4)\nidentifier:                 ai.passioncode.fabric-dashboards'
].join('\n--------------------------------------------------------------------------------\n')

test('every other registration of the id is stale; the target, its helpers and other apps are not', () => {
  assert.deepEqual(staleRegistrations(dump), ['/Applications/Fabric-0.3.20.app', '/Volumes/Work/rollout/Fabric-0.3.24.app'])
})

test('side copies are the other Fabric-*.app bundles beside the target, the staged hidden one included', () => {
  assert.deepEqual(sideCopies(['Fabric.app', 'Fabric-0.3.20.app', '.Fabric-0.3.26.app', 'Fabric Dashboards.app', 'Fabric Inbox.app', 'Safari.app']),
    ['.Fabric-0.3.26.app', 'Fabric-0.3.20.app'])
})

test('the staging folder sits beside the target and is not a bundle', () => {
  assert.equal(stagingDir('/Applications/Fabric.app'), '/Applications/.Fabric-update')
  assert.doesNotMatch(stagingDir(), /\.app$/)
  assert.equal(rollbackZip('HOME', '0.3.26'), 'HOME/Library/Application Support/ai.passioncode.fabric/previous/Fabric-0.3.26.zip')
})

const tile = (id, url, book = true) => ({ 'tile-data': { 'bundle-identifier': id, 'file-label': 'x', 'file-data': { _CFURLString: url, _CFURLStringType: 15 }, ...(book ? { book: { __data: 'AAAA' } } : {}) } })
const ours = (url, book) => tile('ai.passioncode.desktop', url, book)

test('the Dock: two Fabric tiles become one at the bundle path, its stale bookmark dropped, other tiles untouched', () => {
  const inbox = tile('ai.passioncode.fabric-inbox', 'file:///Applications/Fabric%20Inbox.app/')
  const { apps, changed, removed } = dedupeDock([ours('file:///Applications/Fabric.app/'), inbox, ours('file:///Applications/Fabric.app/')])
  assert.equal(changed, true)
  assert.equal(removed, 1)
  assert.equal(apps.length, 2)
  assert.equal(apps[0]['tile-data']['file-data']._CFURLString, 'file:///Applications/Fabric.app/')
  assert.equal('book' in apps[0]['tile-data'], false)
  assert.equal(apps[1], inbox)
})

test('the Dock: one tile pointing elsewhere is pointed back; one tile at the bundle is left as it is', () => {
  const moved = dedupeDock([ours('file:///Volumes/Work/rollout/Fabric-0.3.24.app/')])
  assert.equal(moved.changed, true)
  assert.equal(moved.apps[0]['tile-data']['file-data']._CFURLString, 'file:///Applications/Fabric.app/')
  const fine = [ours('file:///Applications/Fabric.app/')]
  assert.deepEqual(dedupeDock(fine), { apps: fine, changed: false, removed: 0 })
  assert.deepEqual(dedupeDock([]), { apps: [], changed: false, removed: 0 })
})

// 0.3.27 review DO-75: launchd's copy runs as `Fabric --background`, and only its executable says which Fabric it is.
test('a Fabric launchd started is seen by its executable, and another app named Fabric is not', () => {
  const T = '/Applications/Fabric.app'
  assert.equal(fabricRunning({ args: '79911 Fabric --background\n', lsof: 'p79911\nftxt\nn/Applications/Fabric.app/Contents/MacOS/Fabric\n' }, T), true)
  assert.equal(fabricRunning({ args: '/Applications/Fabric.app/Contents/MacOS/Fabric\n', lsof: '' }, T), true)
  assert.equal(fabricRunning({ args: '79911 Fabric --background\n', lsof: 'p936\nftxt\nn/Applications/Fabric Inbox.app/Contents/MacOS/Fabric Inbox\n' }, T), false)
  assert.equal(fabricRunning({ args: '', lsof: 'p1\nftxt\nn/Volumes/x/Fabric.app/Contents/MacOS/Fabric\n' }, T), false)
})
