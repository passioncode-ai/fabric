// Removing secrets from a session's record (M95).
//
// WHAT IS AT STAKE. Every byte a session prints is captured into
// `session_transcripts.body`, which `fabric_transcripts_search` makes readable
// by every agent in the project. One `env`, one `cat .env`, one command that
// echoes a token, and a credential is permanently in a store with a search box
// on it. This is also the thing standing between the product and an unattended
// agent mode, because unattended is exactly when nobody sees it happen.
//
// ON THE WAY IN, NOT ON THE WAY OUT. Redacting at read would leave the secret
// in the database and in the spool file on disk — and the spool is readable by
// the very actor being defended against, since an agent session runs as the
// operator. So the bytes are cleaned before they are written anywhere.
//
// WHAT THIS DOES NOT CATCH, stated here rather than discovered later. It matches
// SHAPES: known prefixes, key-looking assignments, URLs carrying a password, PEM
// blocks. A secret with no shape — a password that looks like an English word, a
// token pasted with no name beside it — passes through untouched. That is why
// the count travels with the transcript instead of being swallowed: a record
// that says "3 removed" tells an operator the redactor acted, and a record that
// says nothing is not a promise that there was nothing to act on.

export interface RedactionCount {
  /** Which rule fired — carried into the record so the operator can see it. */
  rule: string
  count: number
}

interface Rule {
  name: string
  re: RegExp
  /** Which capture group is the secret; the rest is context to keep. */
  keep?: (match: RegExpMatchArray) => string
}

const RULES: Rule[] = [
  {
    name: 'private-key',
    // Whole PEM blocks. First, because the body of one contains base64 that the
    // other rules would shred into a hundred separate redactions.
    //
    // THE ORDER OF THIS LIST IS LOAD-BEARING and was found by running it, not by
    // reading it. With the shape rules first, `ANTHROPIC_API_KEY=sk-ant-…`
    // became `ANTHROPIC_API_KEY=[redacted: assignment] anthropic-key]` — the
    // shape rule fired, then `assignment` ate half of the marker the first rule
    // had just written. Broad-and-keeps-context runs before narrow-and-replaces.
    re: /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g
  },
  {
    name: 'header-pair',
    // A header or variable spelled as a name/value PAIR — ACP's `{"name":"Authorization","value":"Bearer …"}`
    // in the session document and `session/new`, the gateway's `x-agw-key` beside it, the stdio
    // bridge's `FABRIC_BRIDGE_AUTHORIZATION` in its `env` list — in JSON, JSON escaped any number of
    // times, a Python dict, or a Python repr (`name='…', value='…'`; Hermes is Python and its stderr
    // reaches the terminal). Audit 2026-10-06 DA-4 / ER-4 / DO-15. Before `assignment`, which would
    // otherwise see none of it. The NAME is kept; the whole value goes, scheme word included.
    re: /(\bname(?:\\*["'])?\s*[:=]\s*\\*["'](?:(?:proxy-)?authorization|x-[a-z0-9-]*(?:key|token|secret)[a-z0-9-]*|api[-_]?key|[a-z0-9_]*_(?:key|token|secret|password|passwd|credentials?|authorization)[a-z0-9_]*)\\*["']\s*,\s*(?:\\*["'])?value(?:\\*["'])?\s*[:=]\s*\\*["'])(\[redacted: header-pair\](?=\\*["'])|[^"'\\\n]+)/gi,
    keep: (m) => `${m[1]}[redacted: header-pair]`
  },
  {
    name: 'assignment',
    // The `env` dump, and every `export FOO_TOKEN=…` in a shell. The NAME is
    // kept: knowing that a session read `AWS_SECRET_ACCESS_KEY` is useful, and
    // is exactly the part that is not a secret.
    // Only the exact emitted marker at a value boundary is already clean.
    // A malformed/lookalike marker is consumed through the line, not merely
    // its first whitespace-delimited word, which could expose its suffix.
    //
    // AUTHORIZATION is a name too, and its value may carry a scheme word: the bridge's
    // `FABRIC_BRIDGE_AUTHORIZATION=Bearer …` kept the token after the space (audit 2026-10-06 DA-4).
    // The name may close a quote (`"GITHUB_TOKEN": "…"` in a JSON-printed environment), and the value
    // may be quoted with escaped quotes (`\"…\"` in JSON printed inside JSON).
    re: /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS|AUTHORIZATION)[A-Z0-9_]*)((?:\\*["'])?\s*[=:]\s*)((?:(?:[Bb]earer|[Bb]asic)\s+)?(?:\[redacted: assignment\](?=$|[\s"',;)}\]\\]|[.!?](?=\s|$))|\[redacted:[^\r\n]*|(?:"[^"\n]*"|'[^'\n]*')[^\s"',;)}\]]*|\\+"[^"\\\n]*\\+"|[^\s\n]+))/g,
    keep: (m) => `${m[1]}${m[2]}[redacted: assignment]`
  },
  {
    name: 'authorization',
    // Also the JSON spelling, `"Authorization": "Bearer …"`: a Kilo session's whole config, the
    // session bearer included, sits in `KILO_CONFIG_CONTENT`, so an `env` printed in that session
    // showed it unredacted (audit 2026-10-05 A6-005).
    // And escaped (`\"Authorization\":\"Bearer …\"`, a JSON-printed environment) or single-quoted
    // (`{'Authorization': 'Bearer …'}`, a Python dict) — audit 2026-10-06 DA-4 / DO-15.
    re: /\b((?:proxy-)?authorization(?:\\*["'])?\s*:\s*(?:\\*["'])?(?:bearer|basic)\s+)(\[redacted: authorization\](?=$|[\s"',;)}\]\\]|[.!?](?=\s|$))|\[redacted:[^\r\n]*|[^\s"'\\,;]+)/gi,
    keep: (m) => `${m[1]}[redacted: authorization]`
  },
  {
    name: 'header-credential',
    // A credential header with no scheme word: the gateway's `x-agw-key` role key in the same Kilo
    // config, and every `x-…-key` / `x-…-token` / `api-key` header spelled like it. The header name
    // is kept, the value is not.
    re: /\b((?:x-[a-z0-9-]*(?:key|token|secret)[a-z0-9-]*|api-key)(?:\\*["'])?\s*:\s*(?:\\*["'])?)(\[redacted: header-credential\](?=$|[\s"',;)}\]\\]|[.!?](?=\s|$))|\[redacted:[^\r\n]*|[^\s"'\\,;]+)/gi,
    keep: (m) => `${m[1]}[redacted: header-credential]`
  },
  {
    name: 'api-key-field',
    // A QUOTED `apiKey` / `api_key` field with a quoted value — a provider config printed as JSON or a
    // Python dict (audit 2026-10-06 DO-15). Both quotes are required, so source code naming the
    // field (`apiKey: string`, `config.apiKey`) is left alone.
    re: /(\\*["']api_?key\\*["']\s*:\s*\\*["'])(\[redacted: api-key-field\](?=\\*["'])|[^"'\\\n]+)/gi,
    keep: (m) => `${m[1]}[redacted: api-key-field]`
  },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{16,}/g },
  { name: 'openai-key', re: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,}/g },
  { name: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g },
  { name: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'aws-key-id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'google-key', re: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  {
    name: 'jwt',
    // Three base64url segments — the shape of a Supabase key, a session token,
    // and most bearer credentials this product hands out.
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
  },
  {
    name: 'url-password',
    // `postgresql://user:password@host` and every scheme shaped like it.
    re: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)(\[redacted:[^@\r\n]*|[^\s@]+)(@)/gi,
    keep: (m) => `${m[1]}[redacted: url-password]${m[3]}`
  }
]

/**
 * Remove what looks like a credential, and say how much was removed.
 *
 * Deterministic and order-dependent: `private-key` runs first so a PEM block is
 * taken whole rather than shredded by the base64-shaped rules that follow.
 */
export function redact(text: string): { text: string; redactions: RedactionCount[] } {
  let out = text
  const counts: RedactionCount[] = []
  for (const rule of RULES) {
    let n = 0
    out = out.replace(rule.re, (...args) => {
      const match = args.slice(0, -2) as unknown as RegExpMatchArray
      const replacement = rule.keep ? rule.keep(match) : `[redacted: ${rule.name}]`
      // A canonical marker is output, not another removed credential. This
      // also keeps counts accurate when independent sinks sanitize twice.
      if (replacement !== match[0]) n++
      return replacement
    })
    if (n > 0) counts.push({ rule: rule.name, count: n })
  }
  return { text: out, redactions: counts }
}

/** One line for the record: what was removed, or nothing when nothing was. */
export function describeRedactions(counts: readonly RedactionCount[]): string | null {
  if (counts.length === 0) return null
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  return `${total} redacted (${counts.map((c) => `${c.rule}×${c.count}`).join(', ')})`
}

/**
 * Redacts every string inside a journal payload, however deeply nested (M195).
 *
 * WHY THE WHOLE PAYLOAD RATHER THAN NAMED FIELDS. Measured 2026-09-06: agents
 * write free text through THIRTEEN fields across eight tools — the brief that
 * asked for this named three. The most dangerous is `task.handoff@1`'s `value`
 * (8 000 characters, and it is precisely the channel one agent uses to pass the
 * next one what it obtained). A named-field list is a list the fourteenth field
 * is missing from, and the field added after this comment was written is always
 * the one nobody adds to it.
 *
 * NO SKIP-LIST, and that is measured rather than hoped: the rules match
 * secret-shaped text only, so ids, enum values, `about` keys and formatted
 * strings pass through byte-identical (probed over nine ordinary values, zero
 * changed). Nothing to forget.
 *
 * The input is never mutated: a caller cannot journal the unscrubbed object by
 * holding on to its reference.
 */
export function redactPayload(payload: Record<string, unknown>): {
  payload: Record<string, unknown>
  redactions: RedactionCount[]
} {
  const totals = new Map<string, number>()

  const walk = (value: unknown): unknown => {
    // A post-sanitization toJSON callback could create fresh, unsanitized data.
    // Produce inert JSON values only; never preserve executable serialization.
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint')
      return `[omitted: ${typeof value}]`
    if (typeof value === 'string') {
      const { text, redactions } = redact(value)
      for (const { rule, count } of redactions) totals.set(rule, (totals.get(rule) ?? 0) + count)
      return text
    }
    if (Array.isArray(value)) return value.map(walk)
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = Object.create(null)
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // Credential-bearing fields carry meaning even when their value has no
        // recognizable prefix. Match words, not arbitrary "key" substrings:
        // idempotency_key, public_key, digest and token_count are protocol data.
        const name = k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/-/g, '_')
        const sensitive = /(?:^|_)(?:api_key|private_key|password|passwd|secret|token|credentials?|authorization|cookie)$/.test(name)
          || name === 'set_cookie'
        if (sensitive && v !== null && v !== undefined && v !== '') {
          out[k] = '[redacted: credential-field]'
          if (v !== out[k]) totals.set('credential-field', (totals.get('credential-field') ?? 0) + 1)
        } else out[k] = walk(v)
      }
      return out
    }
    return value
  }

  return {
    payload: walk(payload) as Record<string, unknown>,
    redactions: [...totals].map(([rule, count]) => ({ rule, count }))
  }
}
