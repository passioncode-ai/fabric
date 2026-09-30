/**
 * Bounded raw JSON admission for archives. Private diagnostics never quote the input.
 *
 * ONE REASON-CODE VOCABULARY, SHARED WITH SQL. The native codec and migration 66 refuse
 * with the same words, so a refusal reads the same whichever side caught it. A code that
 * exists on one side only is how a UI ends up explaining a refusal nobody can produce.
 */
export const ARCHIVE_REASON_CODES = Object.freeze([
  'invalid_json', 'too_large', 'invalid_archive', 'integrity_mismatch', 'unsupported_schema',
  'archive_stale', 'idempotency_conflict', 'not_found', 'unavailable'
] as const)
export type ArchiveReasonCode = (typeof ARCHIVE_REASON_CODES)[number]

export class ArchiveFormatError extends Error {
  readonly code: ArchiveReasonCode
  constructor(code: ArchiveReasonCode) {
    super(code); this.code = code; this.name = 'ArchiveFormatError'
  }
}
export const archiveFail = (code: ArchiveReasonCode = 'invalid_archive'): never => { throw new ArchiveFormatError(code) }

/**
 * THE BUDGET HAS ONE DEFINITION, AND SQL USES THE SAME ONE (plan default 4). The root
 * value is depth 1; a value nested inside an object or an array is one deeper. Every
 * value is one node — objects, arrays and primitives alike; object keys are not nodes.
 * Frozen by vectors (`depth === maxDepth` passes, one deeper refuses; `nodes === budget`
 * passes, one more refuses) rather than by this sentence.
 */
export interface JsonBudget { nodes: number }
export interface JsonAdmission {
  budget?: JsonBudget
  maxDepth?: number
  /**
   * `integers`: every number must be a canonical safe integer — `1.0`, `1e0`, `-0` and
   * `01` refuse (plan default 3; the companion has no other kind of number).
   * `lossless`: any JSON number whose decimal value survives decoding exactly (the
   * ordinary journal, whose payloads are data this codec does not interpret).
   */
  numbers?: 'integers' | 'lossless'
}

export function decodeArchiveUtf8(raw: Uint8Array, maxBytes: number): string {
  if (!(raw instanceof Uint8Array) || raw.byteLength > maxBytes) archiveFail('too_large')
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) archiveFail('invalid_json')
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw) }
  catch { /* not silence: invalid UTF-8 IS the refusal, typed, never quoting the bytes */ return archiveFail('invalid_json') }
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
const CANONICAL_INTEGER = /^-?(?:0|[1-9][0-9]*)$/

/** Duplicate escaped keys are rejected before assignment. No reviver or toJSON runs. */
export function parseArchiveJson(text: string, options: JsonAdmission = {}): unknown {
  const budget = options.budget ?? { nodes: 1_000_000 }
  const maxDepth = options.maxDepth ?? 32
  const numbers = options.numbers ?? 'integers'
  let i = 0
  const bad = (): never => archiveFail('invalid_json')
  const ws = (): void => { while (i < text.length && /[\x20\x09\x0a\x0d]/.test(text[i])) i++ }
  const str = (): string => {
    if (text[i++] !== '"') bad()
    const start = i - 1
    while (i < text.length) {
      const c = text.charCodeAt(i++)
      if (c === 34) {
        let v: string
        try { v = JSON.parse(text.slice(start, i)) as string } catch { /* not silence: an undecodable token IS the refusal; never echoed */ return bad() }
        if (v.includes('\0') || LONE_SURROGATE.test(v)) bad()
        return v
      }
      if (c < 32) bad()
      if (c === 92) {
        const e = text[i++]
        if (e === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i, i + 4))) bad(); i += 4 }
        else if (!e || !'"\\/bfnrt'.includes(e)) bad()
      }
    }
    return bad()
  }
  const number = (): number => {
    const m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i))
    if (!m) return bad()
    i += m[0].length
    const n = Number(m[0])
    if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return bad()
    if (numbers === 'integers') {
      if (!CANONICAL_INTEGER.test(m[0]) || m[0] === '-0' || !Number.isSafeInteger(n)) bad()
      return n
    }
    // Refuse lossy numeric decoding rather than hash rounded attacker bytes.
    const decimal = (s: string): string => {
      const [mantissa, exp = '0'] = s.toLowerCase().split('e'); const negative = mantissa.startsWith('-')
      const bare = negative ? mantissa.slice(1) : mantissa; const [whole, fraction = ''] = bare.split('.')
      let digits = (whole + fraction).replace(/^0+/, ''); if (!digits) return '0'
      let power = Number(exp) - fraction.length
      while (digits.endsWith('0')) { digits = digits.slice(0, -1); power++ }
      return `${negative ? '-' : ''}${digits}e${power}`
    }
    if (decimal(m[0]) !== decimal(String(n))) bad()
    return n
  }
  const value = (depth: number): unknown => {
    if (depth > maxDepth) archiveFail('too_large')
    if (--budget.nodes < 0) archiveFail('too_large')
    ws()
    const c = text[i]
    if (c === '"') return str()
    if (c === '{') {
      i++; ws(); const out: Record<string, unknown> = Object.create(null); const keys = new Set<string>()
      if (text[i] === '}') { i++; return out }
      while (i < text.length) {
        const k = str(); if (keys.has(k)) bad(); keys.add(k); ws(); if (text[i++] !== ':') bad()
        out[k] = value(depth + 1); ws(); const end = text[i++]; if (end === '}') return out
        if (end !== ',') bad(); ws()
      }
      return bad()
    }
    if (c === '[') {
      i++; ws(); const out: unknown[] = []; if (text[i] === ']') { i++; return out }
      while (i < text.length) { out.push(value(depth + 1)); ws(); const end = text[i++]; if (end === ']') return out; if (end !== ',') bad(); ws() }
      return bad()
    }
    for (const [literal, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(literal, i)) { i += literal.length; return v }
    }
    return number()
  }
  const result = value(1); ws(); if (i !== text.length) bad(); return result
}
