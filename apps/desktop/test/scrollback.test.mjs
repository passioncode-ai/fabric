// What one byte of agent output costs, and what a reattaching view sees (FA-08).
//
// MEASURED at d28c321: the data handler concatenated the whole buffer, re-sliced
// it to a 400 000-character cap, then read the ENTIRE capped buffer through a
// regular expression and three intermediate arrays — to produce the 120
// characters of its last line, which had not changed for most of the chunks that
// paid for it. Per chunk. Per session. On the main process's only thread.
// `scripts/bench/pty-output.mjs` measures it and
// `docs/evidence/plans/2026-09-10-output-cost/measurement.txt` records one run.
// The absolute milliseconds move with whatever else the machine is doing, so the
// receipt is the number and this comment is not: what holds across runs is the
// RATIO, roughly thirty times cheaper per chunk at fifty sessions even when the
// tail is read on every one of them, and four orders of magnitude when it is
// read as the product reads it.
//
// Two things are checked here that a benchmark cannot: that the cheaper shape
// answers the SAME last line as the shape it replaces, run against it rather
// than described; and that attaching to a live session neither loses the bytes
// emitted while the replay was in flight nor writes any of them twice.
//
// Pure: no pty is spawned, nothing is written, nothing reaches the network.

import { SCROLLBACK_CAP, createBoundedScrollback } from '../src/main/scrollback.ts'
import { mergeReplay } from '../src/shared/replay.ts'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }
const eq = (got, want, m) =>
  got === want ? ok(m) : fail(m + ' — got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))

const ESC = String.fromCharCode(27)
const colour = (s) => ESC + '[32m' + s + ESC + '[0m'

/** The shape FA-08 replaces, kept here so the new one is checked against what
 *  people actually saw rather than against my description of it. */
const oldTail = (buffer) => {
  const lines = buffer
    .replace(new RegExp(ESC + '\\[[0-9;?]*[a-zA-Z]', 'g'), '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.length ? lines[lines.length - 1].slice(0, 120) : ''
}

// ── what a session holds is bounded ──────────────────────────────────────────
{
  const b = createBoundedScrollback(100)
  b.push('abc')
  b.push('def')
  eq(b.text(), 'abcdef', 'everything is kept while it fits')
  eq(b.size(), 6, 'and the size is what is retained, not what was written')

  const capped = createBoundedScrollback(1_000)
  for (let i = 0; i < 5_000; i++) capped.push('0123456789')
  capped.size() <= 1_000 && capped.text().length === capped.size()
    ? ok('fifty thousand characters through a thousand-character cap holds a thousand')
    : fail('the cap did not bound the buffer: ' + capped.size())

  // The shape this replaces cut at an arbitrary character. A surrogate pair or
  // an escape sequence split in half is output the terminal cannot read, and it
  // appeared only once the cap was reached — the hardest moment to notice.
  // The first chunk must go WHOLE. Trimming it by exactly the overflow would
  // leave a piece of it — which is the arbitrary cut this replaces, and the
  // sizes have to make the two answers differ or the case proves nothing.
  const boundary = createBoundedScrollback(10)
  boundary.push('1234567890')
  boundary.push('abc')
  eq(boundary.text(), 'abc', 'whole chunks are dropped, so no cut lands inside one')

  // And an ODD overflow, because an even one cuts between two surrogate pairs
  // and a split pair would survive the check by luck.
  const pair = String.fromCodePoint(0x1f600) // two UTF-16 units
  const surrogates = createBoundedScrollback(5)
  surrogates.push(pair + pair)
  surrogates.push(pair + pair)
  const units = [...surrogates.text()]
  units.length > 0 && units.every((c) => c === pair)
    ? ok('and every surrogate kept still has its partner')
    : fail('the drop split a surrogate pair: ' + JSON.stringify(surrogates.text()))

  // The ONE place a boundary is invented. A chunk this large is a screen dump,
  // and the cut is a whole cap away from the end.
  const huge = createBoundedScrollback(10)
  huge.push('x'.repeat(50) + 'END')
  huge.size() === 10 && huge.text().endsWith('END')
    ? ok('a single chunk larger than the cap is cut, and the newest end is what survives')
    : fail('an oversized chunk was mishandled: ' + JSON.stringify(huge.text()))

  const empty = createBoundedScrollback(10)
  empty.push('')
  eq(empty.size(), 0, 'an empty chunk is ignored rather than counted')

  eq(SCROLLBACK_CAP, 400_000, 'and the cap is the shipped one, so no probe passes at a size nobody runs')
}

// ── the last line, read from the end ─────────────────────────────────────────
{
  const b = createBoundedScrollback()
  b.push(colour('first') + '\r\n')
  b.push(colour('  second  ') + '\r\n')
  eq(b.tailLine(), 'second', 'the last non-empty line, stripped of colour and trimmed')

  // Not a description of the old rule: the old rule, run, on every prefix.
  const chunks = []
  let seed = 7
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 400; i++) {
    const r = rand()
    if (r < 0.1) chunks.push('\r\n')
    else if (r < 0.2) chunks.push(ESC + '[2J' + ESC + '[H')
    else if (r < 0.3) chunks.push(colour('x'.repeat(150 + Math.floor(rand() * 300))) + '\r\n')
    else chunks.push(colour('line ' + i) + '\r\n')
  }
  const ring = createBoundedScrollback()
  let whole = ''
  let disagreed = null
  for (const c of chunks) {
    ring.push(c)
    whole += c
    if (ring.tailLine() !== oldTail(whole) && disagreed === null)
      disagreed = { got: ring.tailLine(), wanted: oldTail(whole) }
  }
  disagreed === null
    ? ok('and it agrees with the shape it replaces on all 400 prefixes of a mixed stream')
    : fail('the cheaper shape answered a different line: ' + JSON.stringify(disagreed))

  // A bounded scan that gave up would report no output for a session that has
  // some, and a tile showing nothing is a claim that nothing was said.
  const buried = createBoundedScrollback()
  buried.push(colour('the only thing ever said') + '\r\n')
  buried.push('\r\n'.repeat(20_000))
  eq(buried.tailLine(), 'the only thing ever said', 'the window widens rather than answering nothing')

  const blank = createBoundedScrollback()
  blank.push('   \r\n  \r\n')
  eq(blank.tailLine(), '', 'a buffer that never held a line answers empty, not a stale line')

  // The first line of a window can be the tail of a longer one. Trusting it
  // would show half a sentence as the session status.
  // A line LONGER than the window, with a distinctive start. Reading the window
  // as though its first line were whole answers the middle of the line; the
  // widened read answers the line. A uniform line hides the difference, so this
  // one is not uniform.
  // MANY chunks, because the window takes whole chunks: a single chunk can never
  // be cut by it, so a one-chunk case cannot reach the branch this checks.
  const halves = createBoundedScrollback()
  halves.push('BEGIN')
  for (let i = 0; i < 15; i++) halves.push('A'.repeat(2_000))
  halves.tailLine().startsWith('BEGIN')
    ? ok('a line the window cut in half is not trusted — the whole line is found')
    : fail('the tail was read from the middle of a line: ' + JSON.stringify(halves.tailLine().slice(0, 20)))
  const followed = createBoundedScrollback()
  followed.push('A'.repeat(30_000) + '\r\n')
  followed.push('short line\r\n')
  eq(followed.tailLine(), 'short line', 'and a short last line after a very long one is still the answer')

  const moving = createBoundedScrollback()
  moving.push('one\r\n')
  const before = moving.tailLine()
  moving.push('two\r\n')
  before === 'one' && moving.tailLine() === 'two'
    ? ok('and it is recomputed after new output rather than served stale')
    : fail('the tail did not move: ' + before + ' then ' + moving.tailLine())

  const long = createBoundedScrollback()
  long.push('y'.repeat(400) + '\r\n')
  eq(long.tailLine().length, 120, 'what is shown is capped at 120 characters')
}

// ── attaching to a live session loses nothing and repeats nothing ────────────
{
  const replay = { text: 'abc', written: 3 }

  eq(
    JSON.stringify(mergeReplay({ replay, held: [
      { data: 'b', written: 2 }, { data: 'c', written: 3 }, { data: 'd', written: 4 }
    ] })),
    JSON.stringify(['abc', 'd']),
    'the replay is written, then only what came after it'
  )

  // The bytes the old shape lost: emitted after the snapshot the view was
  // handed, and before it subscribed.
  eq(
    mergeReplay({ replay: { text: 'ab', written: 2 }, held: [
      { data: 'c', written: 3 }, { data: 'd', written: 4 }
    ] }).join(''),
    'abcd',
    'and the gap between the snapshot and the subscription is written, not lost'
  )

  eq(
    JSON.stringify(mergeReplay({ replay, held: [{ data: 'c', written: 3 }] })),
    JSON.stringify(['abc']),
    'nothing the replay already contained is written twice'
  )

  eq(
    JSON.stringify(mergeReplay({ replay: null, held: [{ data: 'x', written: 9 }] })),
    JSON.stringify(['x']),
    'a replay that could not be read still shows the live stream'
  )

  eq(
    JSON.stringify(mergeReplay({ replay: { text: '', written: 0 }, held: [] })),
    JSON.stringify([]),
    'and a session that has said nothing writes nothing at all'
  )

  eq(
    mergeReplay({ replay: { text: '', written: 0 }, held: [
      { data: '1', written: 1 }, { data: '2', written: 2 }, { data: '3', written: 3 }
    ] }).join(''),
    '123',
    'the order the terminal produced is the order written'
  )
}

if (failures) {
  console.log('\n' + failures + ' failure(s)')
  process.exit(1)
}
console.log('\nall green: output is bounded per chunk, the tail matches the old rule, and a reattach loses nothing')
