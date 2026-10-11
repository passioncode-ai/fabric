// scripts/lib/universal-mac.mjs against the installed node-pty: its thin darwin prebuilds become one
// universal file in both folders, other platforms' prebuilds go, a second run changes nothing, the
// module still runs a command on a PTY, and `thinMachO` finds a thin Intel-only binary.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { foreignPrebuilds, slices, thinMachO, universalizeNodePty } from '../lib/universal-mac.mjs'

const source = path.dirname(createRequire(new URL('../../apps/desktop/package.json', import.meta.url)).resolve('node-pty/package.json'))

test('node-pty prebuilds become universal in both darwin folders; other platforms are named', { skip: process.platform !== 'darwin' && 'needs lipo' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-universal-'))
  try {
    const module = path.join(dir, 'node-pty')
    cpSync(source, module, { recursive: true, dereference: true })
    mkdirSync(path.join(module, 'prebuilds', 'win32-x64'), { recursive: true })
    writeFileSync(path.join(module, 'prebuilds', 'win32-x64', 'pty.node'), 'not for macOS')
    assert.deepEqual(slices(path.join(module, 'prebuilds/darwin-x64/pty.node')), ['x86_64'], 'node-pty ships thin files')
    assert.ok(foreignPrebuilds(module).includes('win32-x64'), 'a foreign prebuild is named')
    for (const entry of foreignPrebuilds(module)) rmSync(path.join(module, 'prebuilds', entry), { recursive: true })
    assert.deepEqual(foreignPrebuilds(module), [])
    universalizeNodePty(module, source)
    assert.deepEqual(readdirSync(path.join(module, 'prebuilds')).sort(), ['darwin-arm64', 'darwin-x64'])
    for (const arch of ['arm64', 'x64']) for (const file of ['pty.node', 'spawn-helper'])
      assert.deepEqual(slices(path.join(module, 'prebuilds', `darwin-${arch}`, file)), ['arm64', 'x86_64'], `${arch}/${file}`)
    const first = readFileSync(path.join(module, 'prebuilds/darwin-x64/pty.node'))
    universalizeNodePty(module, source)
    assert.ok(first.equals(readFileSync(path.join(module, 'prebuilds/darwin-x64/pty.node'))), 'idempotent')
    assert.deepEqual(thinMachO(path.join(module, 'prebuilds')), [])
    const probe = path.join(dir, 'probe.cjs')
    writeFileSync(probe, `const p = require(${JSON.stringify(module)}).spawn('/bin/echo', ['universal-ok'], { cols: 40, rows: 5, cwd: '/', env: { PATH: '/bin' } });
let out = ''; p.onData((d) => { out += d; }); p.onExit((e) => { process.stdout.write(JSON.stringify({ out, code: e.exitCode })); process.exit(0); });`)
    const r = spawnSync(process.execPath, [probe], { encoding: 'utf8', timeout: 20_000 })
    const answer = JSON.parse(r.stdout || 'null')
    assert.equal(answer?.code, 0, r.stderr)
    assert.match(answer.out, /universal-ok/)
    // The check finds a thin Intel-only binary the way the 0.3.2 bundle carried one; text is skipped.
    const thin = path.join(dir, 'thin')
    mkdirSync(thin)
    spawnSync('lipo', [path.join(module, 'prebuilds/darwin-x64/pty.node'), '-thin', 'x86_64', '-output', path.join(thin, 'pty.node')])
    writeFileSync(path.join(thin, 'notes.txt'), 'text')
    assert.deepEqual(thinMachO(thin), ['pty.node [x86_64]'])
    // A file that says it is a Mach-O but lipo cannot read is not a pass, and a 64-bit fat header is a Mach-O
    // (0.3.4 verification, iteration 1, ER-5): both are reported, never skipped.
    writeFileSync(path.join(thin, 'corrupt'), Buffer.concat([Buffer.from('cffaedfe', 'hex'), Buffer.alloc(60, 7)]))
    writeFileSync(path.join(thin, 'fat64'), Buffer.concat([Buffer.from('cafebabf', 'hex'), Buffer.alloc(60, 0)]))
    assert.deepEqual(thinMachO(thin).sort(), ['corrupt [unknown]', 'fat64 [unreadable]', 'pty.node [x86_64]'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a module without darwin prebuilds for both architectures is refused', { skip: process.platform !== 'darwin' && 'needs lipo' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-universal-'))
  try {
    const module = path.join(dir, 'node-pty'), broken = path.join(dir, 'source')
    mkdirSync(path.join(module, 'prebuilds', 'darwin-arm64'), { recursive: true })
    mkdirSync(path.join(module, 'prebuilds', 'darwin-x64'), { recursive: true })
    cpSync(path.join(source, 'prebuilds', 'darwin-arm64'), path.join(broken, 'prebuilds', 'darwin-arm64'), { recursive: true })
    assert.throws(() => universalizeNodePty(module, broken), /both architectures/)
    assert.equal(existsSync(path.join(module, 'prebuilds', 'darwin-x64', 'pty.node')), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
