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

/** Words a value takes in ordinary text and code, never a credential: `SECRET: none`, `token = null`. */
const PLAIN_VALUE = /^(?:on|off|yes|no|true|false|none|null|nil|undefined|empty|unset|n\/a|-|0x0|\*+|x+)$/i

/** A name that is an upper-case keyword alone, `PASSWORD` or `TOKEN_FILE`, rather than a longer name holding one
 *  after its first letter (`GITHUB_TOKEN`, `TOKEN_SECRET`): those keep v0.3.11's rule unchanged. */
const bareKeyword = (name: string): boolean =>
  !/^[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTHORIZATION)/.test(name)

/** A value after a bare upper-case keyword that is taken as a secret. The separator must be `=` (an environment line,
 *  `PASSWORD=hunter2`) or a quoted name's `:` (`"TOKEN": "…"` in JSON): `TOKEN: 42 used` and `SECRET: none here` are
 *  prose and log lines. And not a plain word or a small number: `KEY=1`, `TOKEN=on`. */
const bareValueIsSecret = (separator: string, value: string): boolean => {
  if (!separator.includes('=') && !/["']/.test(separator)) return false
  if (value.startsWith('[redacted:')) return true
  const bare = value.replace(/^\\*["']|\\*["']$/g, '')
  return bare.length > 0 && !PLAIN_VALUE.test(bare) && !/^\d{1,6}$/.test(bare)
}

/** A value after a lower-case `password=` / `token =` that is taken as a secret: not code and not a plain word. */
const lowerValueIsSecret = (name: string, separator: string, value: string): boolean => {
  if (value.startsWith('[redacted:')) return true
  if (/^["']/.test(value)) return value.length > 2 && !PLAIN_VALUE.test(value.slice(1, -1))
  if (value.includes('(')) return false // a call: `token = getToken()`
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value)) return false // a member: `token = this.token`
  if (/\s/.test(separator) && /^[A-Za-z_$][\w$]*$/.test(value) && !/\d/.test(value)) return false // `token = token`
  if (PLAIN_VALUE.test(value)) return false
  // A password is short and may be all digits (`password=1234`); a token, secret or key is a long opaque string, so a
  // short value under such a name (`token=42`, `token=abc`) is a count or a placeholder.
  return /pass/.test(name) ? value.length >= 4 : value.length >= 8
}

/** A `{ name, value }` pair's value worth taking as a credential: a string, not a count or a plain word. */
const pairValueIsSecret = (value: unknown): boolean =>
  typeof value === 'string' && value !== '' && !PLAIN_VALUE.test(value) && !/^\d{1,6}$/.test(value)

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
    name: 'header-pair-value-first',
    // The same pair written value first — `{"value":"Bearer …","name":"Authorization"}`. Fabric never writes
    // this order, an agent's own serializer may (0.3.2 verification i3 DA-2). The NAME is kept.
    re: /(\bvalue(?:\\*["'])?\s*[:=]\s*\\*["'])(\[redacted: header-pair\](?=\\*["'])|[^"'\\\n]+)(\\*["']\s*,\s*(?:\\*["'])?name(?:\\*["'])?\s*[:=]\s*\\*["'](?:(?:proxy-)?authorization|x-[a-z0-9-]*(?:key|token|secret)[a-z0-9-]*|api[-_]?key|[a-z0-9_]*_(?:key|token|secret|password|passwd|credentials?|authorization)[a-z0-9_]*)\\*["'])/gi,
    keep: (m) => `${m[1]}[redacted: header-pair]${m[3]}`
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
    // The name may be the keyword alone (`PASSWORD=…`, CO-386), not only a longer name holding it. A bare keyword is a
    // whole word (or the keyword and an `_…` suffix, `TOKEN_FILE`): `KEYBOARD` and `TOKENS` are not names of a secret
    // (0.3.12 review DO-3 / ER-4). It is held to more in `keep` below, because it is also an ordinary word in a log.
    re: /\b((?:[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS|AUTHORIZATION)[A-Z0-9_]*|(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS|CREDENTIAL|AUTHORIZATION)(?:_[A-Z0-9_]*)?(?![A-Z0-9_])))((?:\\*["'])?\s*[=:]\s*)((?:(?:[Bb]earer|[Bb]asic)\s+)?(?:\[redacted: assignment\](?=$|[\s"',;)}\]\\]|[.!?](?=\s|$))|\[redacted:[^\r\n]*|(?:"[^"\n]*"|'[^'\n]*')[^\s"',;)}\]]*|\\+"[^"\\\n]*\\+"|[^\s\n]+))/g,
    keep: (m) => (bareKeyword(m[1]) && !bareValueIsSecret(m[2], m[3]) ? m[0] : `${m[1]}${m[2]}[redacted: assignment]`)
  },
  {
    name: 'assignment-lower',
    // The same in lower case with `=` (CO-386): `password=hunter2` in a log line or a query string, `db_password=…`.
    // `=` only, so a type annotation in source (`password: string`) is left alone; the value stops at `&`.
    // Not a comparison (`password === confirm`: the value may not start with `=`), and in `keep` not code: a call
    // (`token = getToken()`), a member (`token = this.token`), a bare identifier written with spaces round the `=`,
    // a literal such as `null`, or a small count under a token or key name (0.3.12 review ER-4).
    re: /\b((?:[a-z][a-z0-9_]*_)?(?:password|passwd|secret|token|api_?key|apikey))(\s*=(?!=)\s*)(\[redacted: assignment\](?=$|[\s"',;&)}\]\\]|[.!?](?=\s|$))|"[^"\n]*"|'[^'\n]*'|[^\s&"',;)}\]=][^\s&"',;)}\]]*)/g,
    keep: (m) => (lowerValueIsSecret(m[1], m[2], m[3]) ? `${m[1]}${m[2]}[redacted: assignment]` : m[0])
  },
  {
    name: 'authorization',
    // Also the JSON spelling, `"Authorization": "Bearer …"`: a Kilo session's whole config, the
    // session bearer included, sits in `KILO_CONFIG_CONTENT`, so an `env` printed in that session
    // showed it unredacted (audit 2026-10-05 A6-005).
    // And escaped (`\"Authorization\":\"Bearer …\"`, a JSON-printed environment) or single-quoted
    // (`{'Authorization': 'Bearer …'}`, a Python dict) — audit 2026-10-06 DA-4 / DO-15.
    re: /\b((?:proxy-)?authorization(?:\\*["'])?\s*:\s*(?:\\*["'])?(?:bearer|basic|token)\s+)(\[redacted: authorization\](?=$|[\s"',;)}\]\\]|[.!?](?=\s|$))|\[redacted:[^\r\n]*|[^\s"'\\,;]+)/gi,
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
  {
    name: 'authorization-field',
    // A QUOTED authorization field with no scheme word (CO-222, DA-6): `{"authorization":"<token>"}`, single-quoted or
    // escaped. Both quotes are required, as for `api-key-field`; a value that starts with a scheme word is the
    // `authorization` rule's, which keeps the word. A value with a space is prose, not a credential (ER-6), and so is a short or digitless word (`'none'`,
    // `"ask-the-operator"`; iteration 2, ER-2): the value must look like a token, 12 or more characters with a digit.
    re: /(\\*["'](?:proxy-)?authorization\\*["']\s*:\s*\\*["'])(?!(?:bearer|basic|token)\s)(\[redacted: authorization-field\](?=\\*["'])|\[redacted:[^"'\n]*|(?=[^"'\\\s]*\d)[^"'\\\s]{12,}(?=\\*["']))/gi,
    keep: (m) => (m[2].startsWith('[redacted:') ? m[0] : `${m[1]}[redacted: authorization-field]`)
  },
  {
    name: 'json-credential-field',
    // A QUOTED credential field printed as JSON or a Python dict (0.3.13 review, iteration 2, DA-5): `"access_token"`,
    // `"refresh_token"`, `"id_token"`, `"client_secret"`, `"password"`, `"passwd"`, `"secret"`, `"token"`, with a quoted
    // value that looks like a secret: no space, 8 or more characters with a digit or a sign, or 16 or more; so a word such
    // as `"required"` and a sentence stay.
    re: /(\\*["'](?:access_token|refresh_token|id_token|client_secret|password|passwd|secret|token)\\*["']\s*:\s*\\*["'])(\[redacted: json-credential-field\](?=\\*["'])|(?=[^"'\\\s]*[^A-Za-z"'\\\s])[^"'\\\s]{8,}(?=\\*["'])|[^"'\\\s]{16,}(?=\\*["']))/gi,
    keep: (m) => `${m[1]}[redacted: json-credential-field]`
  },
  {
    name: 'yaml-credential',
    // A credential in a YAML block (CO-222, ER-5): `  Authorization: <token>` or `  api_key: <token>` at the start of a
    // line, the value with no scheme word. Only a value that looks like a token (16 or more token characters holding a
    // digit, no dot or space) or a quoted one, so a type (`password: string`), prose (`authorization: required`) and code
    // (`secret: process.env.SECRET`) stay; a quoted value with a space is prose, never a token (0.3.13 review ER-6:
    // `Password: "must be at least 12 characters"` was rewritten for good before it reached the journal).
    re: /^([ \t]*(?:proxy-)?(?:authorization|(?:[a-z0-9_]*_)?(?:api_?key|apikey|token|secret|password|passwd)):[ \t]*)(?!(?:bearer|basic|token)\s)(?!\[redacted:)("(?=[^"\s]*\d)[^"\s]{12,}"|'(?=[^'\s]*\d)[^'\s]{12,}'|(?=[A-Za-z0-9_~+/=-]*\d)[A-Za-z0-9_~+/=-]{16,}(?=[ \t]*$))/gim,
    keep: (m) => `${m[1]}[redacted: yaml-credential]`
  },
  {
    name: 'bearer',
    // A bare `Bearer <token>` with no `Authorization:` before it (CO-386), as a client prints it. The token must look
    // like one (16 or more token characters), so prose such as «a Bearer token» stays.
    re: /\b([Bb]earer\s+)(\[redacted: bearer\]|[A-Za-z0-9._~+/-]{16,}=*)/g,
    keep: (m) => `${m[1]}[redacted: bearer]`
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

  /** A field or header name that carries a credential: the words below at its end, an `x-…-key` / `-token` / `-secret`
   *  header such as `x-agw-key`, or `apikey` (CO-386). Not a bare "key": idempotency_key and public_key are data. */
  const sensitiveName = (raw: string): boolean => {
    const name = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/-/g, '_')
    return /(?:^|_)(?:api_key|apikey|private_key|password|passwd|secret|token|credentials?|authorization|cookie)$/.test(name)
      || /^x_[a-z0-9_]*(?:key|token|secret)$/.test(name)
      || name === 'set_cookie'
  }
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
      const obj = value as Record<string, unknown>
      // A header written as a pair, `{ name: 'Authorization', value: 'Bearer …' }` (CO-386): the value goes, the name stays.
      // A count or a plain word is a parameter (`{ name: 'max_token', value: 4096 }`), not a credential (0.3.12 review ER-4).
      const pairSecret = typeof obj.name === 'string' && pairValueIsSecret(obj.value) && sensitiveName(obj.name)
      for (const [k, v] of Object.entries(obj)) {
        // Credential-bearing fields carry meaning even when their value has no
        // recognizable prefix. Match words, not arbitrary "key" substrings:
        // idempotency_key, public_key, digest and token_count are protocol data.
        const sensitive = sensitiveName(k) || (pairSecret && k === 'value')
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
