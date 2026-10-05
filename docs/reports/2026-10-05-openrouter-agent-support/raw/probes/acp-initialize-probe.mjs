// ACP initialize probe: spawn an agent's ACP mode, send `initialize`, print the reply's capabilities.
import { spawn } from 'node:child_process'
const [cmd, ...args] = process.argv.slice(2)
const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: process.env.PROBE_CWD || process.cwd() })
let buf = '', done = false
const finish = (code, msg) => { if (done) return; done = true; console.log(msg); child.kill('SIGTERM'); setTimeout(() => process.exit(code), 300) }
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); if (m.id === 1) finish(0, JSON.stringify(m, null, 1).slice(0, 2500)) } catch {} } })
let err = ''; child.stderr.on('data', d => { err += d })
child.on('exit', c => finish(1, 'exited ' + c + ' stderr: ' + err.slice(0, 400)))
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }, clientInfo: { name: 'fabric-probe', version: '0.0.0' } } }) + '\n')
setTimeout(() => finish(2, 'timeout; stderr: ' + err.slice(0, 400)), 40000)
