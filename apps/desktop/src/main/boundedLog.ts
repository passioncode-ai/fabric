// #region bounded-log — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// A small text log that APPENDS and stays bounded (ST-4 of the 0.3.9 stability audit). startup-failure.log was
// written with writeFileSync, so each failed start erased the one before it: on 2026-10-20 eight starts failed and only
// the last one's words survived. Entries are kept whole; when the file would pass `maxBytes`, the oldest entries go,
// cut at a line boundary so no entry is left half-read.
//
// ELECTRON-FREE and NEVER THROWS: it runs on the way to the startup dialog, and a log that cannot be written must not
// become the reason nothing is shown. The answer says whether it worked; the caller records a failure.
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import path from 'node:path'

export const STARTUP_LOG_MAX_BYTES = 256 * 1024

export function appendBounded(file: string, entry: string, opts: { maxBytes?: number } = {}): { ok: true } | { ok: false; error: unknown } {
  const max = Math.max(256, opts.maxBytes ?? STARTUP_LOG_MAX_BYTES)
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    let current = ''
    try {
      current = readFileSync(file, 'utf8')
    } catch (e) {
      // No file yet is the ordinary first entry; anything else is the caller's to record through the answer.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
    let text = current + (entry.endsWith('\n') ? entry : entry + '\n')
    if (Buffer.byteLength(text) > max) {
      // Keep the newest bytes, then drop up to the first whole line so the file starts on an entry's line.
      const buf = Buffer.from(text)
      let tail = buf.subarray(buf.length - max).toString('utf8')
      const nl = tail.indexOf('\n')
      tail = nl >= 0 && nl < tail.length - 1 ? tail.slice(nl + 1) : tail
      // The UTF-8 decode of a cut multi-byte character can grow the string by a replacement character; trim again.
      while (Buffer.byteLength(tail) > max) {
        const next = tail.indexOf('\n')
        if (next < 0) { tail = tail.slice(tail.length - Math.floor(max / 4)); break }
        tail = tail.slice(next + 1)
      }
      text = tail
    }
    const tmp = `${file}.${process.pid}.tmp`
    const fd = openSync(tmp, 'w', 0o600)
    try {
      writeSync(fd, text)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, file)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}
// #endregion bounded-log
