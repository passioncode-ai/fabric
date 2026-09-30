// What one byte of agent output costs the main process.
//
// FA-08 names a measurement, not a budget: "record measured latency instead of
// inventing a budget". So this script MEASURES and prints; it never fails, and
// nothing in CI depends on its numbers. A gate over them is the operator's
// decision once a budget exists, and until then a threshold here would be an
// invention wearing a measurement's clothes.
//
// The subject is the per-chunk work the PTY data handler does, at 1, 10 and 50
// concurrent sessions. WHAT IS NOT MEASURED, said plainly so the receipt is not
// read as more than it is: node-pty's own throughput, the IPC hop to the
// renderer, React's commit cost, and the transcript spool's disk writes. Those
// need a running application; this needs a fixture and a clock, and it isolates
// the one thing FA-08 identified — full-buffer work per chunk.
//
// Usage: node --expose-gc scripts/bench/pty-output.mjs [--json] [--chunks N]

import { createBoundedScrollback, SCROLLBACK_CAP } from '../../apps/desktop/src/main/scrollback.ts'
import { cpus, totalmem, arch, release, platform } from 'node:os'

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const CHUNKS = Number(argv[argv.indexOf('--chunks') + 1]) || 4000
const ESC = String.fromCharCode(27)

// A workload shaped like an agent talking: mostly short coloured lines, the
// occasional long one, and a screen redraw every so often. Deterministic, so
// two runs on one machine compare.
function fixture(count) {
  const out = []
  let seed = 20260910
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < count; i++) {
    const r = rand()
    if (r < 0.06) out.push(ESC + '[2J' + ESC + '[H')
    else if (r < 0.12)
      out.push(ESC + '[32m' + 'x'.repeat(200 + Math.floor(rand() * 1800)) + ESC + '[0m\r\n')
    else out.push(ESC + '[36m' + i.toString(36) + ESC + '[0m thinking about the next step\r\n')
  }
  return out
}

/** The shape this card found, kept verbatim so the comparison is honest: the
 *  whole capped buffer is re-scanned on every chunk to learn its last line. */
function wholeBufferSession() {
  let scrollback = ''
  let tail = ''
  return {
    push(data) {
      scrollback = (scrollback + data).slice(-SCROLLBACK_CAP)
      const lines = scrollback
        .replace(new RegExp(ESC + '\\[[0-9;?]*[a-zA-Z]', 'g'), '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length) tail = lines[lines.length - 1].slice(0, 120)
    },
    text: () => scrollback,
    tailLine: () => tail
  }
}

const data = fixture(2000)

function measure(make, sessions, chunks) {
  let bufs = Array.from({ length: sessions }, make)
  const samples = new Float64Array(chunks)
  global.gc?.()
  const heapBefore = process.memoryUsage().heapUsed
  for (let i = 0; i < chunks; i++) {
    const chunk = data[i % data.length]
    const t0 = process.hrtime.bigint()
    for (const b of bufs) b.push(chunk)
    samples[i] = Number(process.hrtime.bigint() - t0) / 1e6
  }
  const heapAfter = process.memoryUsage().heapUsed
  const sorted = Array.from(samples).sort((a, b) => a - b)
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
  const held = bufs.reduce((n, b) => n + b.text().length, 0)
  // Dropping every session models what closing a window leaves behind.
  bufs = []
  global.gc?.()
  const heapAfterClose = process.memoryUsage().heapUsed
  return {
    sessions,
    p50_ms: +at(0.5).toFixed(4),
    p95_ms: +at(0.95).toFixed(4),
    p99_ms: +at(0.99).toFixed(4),
    max_ms: +sorted[sorted.length - 1].toFixed(4),
    total_ms: +sorted.reduce((a, b) => a + b, 0).toFixed(1),
    chars_held: held,
    heap_growth_mb: +((heapAfter - heapBefore) / 1048576).toFixed(1),
    heap_after_close_mb: +((heapAfterClose - heapBefore) / 1048576).toFixed(1)
  }
}

const machine = {
  platform: platform() + ' ' + release(),
  arch: arch(),
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  memory_gb: +(totalmem() / 1073741824).toFixed(1),
  node: process.version,
  gc_exposed: typeof global.gc === 'function'
}

const report = { machine, chunks_per_session: CHUNKS, cap_chars: SCROLLBACK_CAP, runs: [] }
for (const sessions of [1, 10, 50]) {
  report.runs.push({ shape: 'whole-buffer-per-chunk', ...measure(wholeBufferSession, sessions, CHUNKS) })
  report.runs.push({ shape: 'bounded-chunk-ring', ...measure(() => createBoundedScrollback(), sessions, CHUNKS) })
  // The row that keeps the comparison honest. The ring reads its tail LAZILY,
  // and the shape it replaces read it eagerly on every chunk — so without this
  // row the table would be crediting the new structure with a saving that is
  // partly just not doing the work yet. In the running product the tail is read
  // when the renderer lists sessions, seconds apart rather than per chunk; this
  // row is the pessimistic bound, where every chunk is followed by a read.
  report.runs.push({
    shape: 'bounded-chunk-ring + tail read per chunk',
    ...measure(() => {
      const b = createBoundedScrollback()
      return { push: (c) => { b.push(c); b.tailLine() }, text: () => b.text(), tailLine: () => b.tailLine() }
    }, sessions, CHUNKS)
  })
}

if (asJson) console.log(JSON.stringify(report, null, 2))
else {
  console.log('machine: ' + machine.cpu + ' · ' + machine.cores + ' cores · ' + machine.memory_gb + ' GB · node ' + machine.node)
  console.log(
    'workload: ' + CHUNKS + ' chunks per session, cap ' + SCROLLBACK_CAP + ' chars, gc ' +
      (machine.gc_exposed ? 'exposed' : 'NOT exposed — run with --expose-gc or read heap numbers as indicative only')
  )
  console.log('')
  console.log(['shape', 'sessions', 'p50 ms', 'p95 ms', 'p99 ms', 'total ms', 'chars held', 'after close MB'].join('\t'))
  for (const r of report.runs)
    console.log([r.shape, r.sessions, r.p50_ms, r.p95_ms, r.p99_ms, r.total_ms, r.chars_held, r.heap_after_close_mb].join('\t'))
  console.log('')
  console.log('chars held is the acceptance criterion: it must not exceed the cap times the session count.')
  console.log('heap growth DURING a run is reported in --json but not here — it is GC timing as much as retention,')
  console.log('and reading it as retention is the kind of claim this card forbids. What is retained is chars held.')
  console.log('')
  console.log('Measurements of this machine under this fixture. They are not a budget, and no gate reads them.')
}
