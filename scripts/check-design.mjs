#!/usr/bin/env node
// Two mechanical gates for the desktop interface, both of which exist so that a
// new screen cannot quietly invent what it looks like or what it says:
//
//   PALETTE — no raw colour in the renderer: components and the app stylesheet
//             consume var(--…) only. Scope is the renderer because that is where
//             the token layer exists; the main process paints exactly one
//             pre-stylesheet surface (the boot splash) and it mirrors --bg/--ink
//             by hand, which is stated at that call site.
//             Values live in the style pack's token layer
//             (tokens.paperclip.css, copied verbatim from the pack) and in the
//             app's semantic aliases (tokens.app.css). Everything else consumes
//             var(--…).
//   TYPE + SPACE — no raw font-size, letter-spacing, line-height or padding/gap
//             px literal in the renderer's own stylesheet. The style pack ships
//             a rem-based type ramp and a space ladder; a screen that hand-picks
//             12.5px is wearing a lookalike rather than the pack, and it stops
//             responding to the reader's text-size setting. Added 2026-08-31
//             after an audit found every size in styles.css was a px literal
//             while the pack's whole ramp sat unspent.
//   STRINGS — no user-visible literal in a component, and every key the code
//             uses exists in the primary registry.
//
// Both are deliberately dumb and fast. They are watched failing in the run that
// introduced them (see docs/evidence/verification.md), which is the only reason
// a green line from them means anything.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'apps/desktop/src')
const TOKEN_FILES = new Set(['tokens.paperclip.css', 'tokens.passioncode.css', 'tokens.app.css'])

let failures = 0
const fail = (msg) => {
  failures++
  console.error(`  FAIL ${msg}`)
}
const ok = (msg) => console.log(`  ok   ${msg}`)

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(SRC)
const rel = (f) => path.relative(ROOT, f)

// A test file is not interface. It renders fixtures on purpose — `<Row>only</Row>`
// is the assertion, not a string someone forgot to translate — and asserting a
// colour is sometimes exactly what a test is for. Added 2026-09-03 with the first
// renderer test (M117): the strings check reported 27 failures against the
// component suite's own fixtures, which is the gate misreading its scope rather
// than the suite breaking a rule.
const isTest = (f) => /\.test\.(tsx?|mts|mjs)$/.test(f)
const shipped = files.filter((f) => !isTest(f))

// ── palette ────────────────────────────────────────────────────────────────
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
let paletteHits = 0
for (const f of shipped) {
  const base = path.basename(f)
  if (TOKEN_FILES.has(base)) continue
  if (!/\.(css|tsx|ts)$/.test(f)) continue
  if (!f.includes('/renderer/')) continue
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
    if (COLOUR.test(line)) {
      fail(`${rel(f)}:${i + 1} raw colour — use a token from tokens.app.css`)
      paletteHits++
    }
  })
}
if (paletteHits === 0) ok('palette: no raw colour outside the token layer')

// ── PassionCode adoption (CO-169) ──────────────────────────────────────────
// The shared design system is vendored byte-for-byte with its source commit and
// SHA-256, the way Switchboard pins it. Three checks: the bytes still match the
// manifest (a local edit is drift, not a tweak); every --pc-* the app layer
// names is defined in that file; and every colour, focus and state role the
// components consume resolves to a --pc-* role rather than to the old pack.
{
  const TOKENS_DIR = path.join(SRC, 'renderer/src')
  const manifest = JSON.parse(readFileSync(path.join(TOKENS_DIR, 'tokens.passioncode.manifest.json'), 'utf8'))
  const vendored = readFileSync(path.join(ROOT, manifest.files[0].vendored))
  const { createHash } = await import('node:crypto')
  const digest = createHash('sha256').update(vendored).digest('hex')
  if (digest !== manifest.files[0].sha256) fail(`tokens.passioncode.css differs from its manifest (${digest.slice(0, 12)} ≠ ${manifest.files[0].sha256.slice(0, 12)}) — re-vendor from ${manifest.commit.slice(0, 7)}, never edit in place`)
  else ok(`passioncode: vendored tokens match ${manifest.system} ${manifest.version} @ ${manifest.commit.slice(0, 7)}`)
  const defined = new Set([...vendored.toString('utf8').matchAll(/(--pc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const appCss = readFileSync(path.join(TOKENS_DIR, 'tokens.app.css'), 'utf8')
  const missing = [...new Set([...appCss.matchAll(/var\((--pc-[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((t) => !defined.has(t))
  for (const t of missing) fail(`tokens.app.css names ${t}, which the vendored design system does not define`)
  const ROLES = ['--app-bg', '--app-panel', '--app-panel-quiet', '--app-ink', '--app-muted', '--app-line', '--app-line-strong',
    '--app-accent', '--app-accent-ink', '--app-focus', '--app-link',
    '--state-running', '--state-blocked', '--state-idle', '--state-ended', '--state-good', '--state-danger']
  const offSystem = ROLES.filter((role) => !new RegExp(`${role}\\s*:\\s*var\\(--pc-`).test(appCss))
  for (const role of offSystem) fail(`${role} does not resolve to a --pc-* role in tokens.app.css`)
  if (!missing.length && !offSystem.length) ok(`passioncode: ${ROLES.length} colour, focus and state roles resolve to --pc-* roles`)

  // The product mockups are the target design and inline the same three token
  // files, so they obey the same palette: no raw colour, and no variable that
  // nothing defines. An undefined var() does not fail in a browser — it silently
  // falls back — which is how `--app-text` went unnoticed in three stylesheets.
  // Variables a renderer sets inline (style="--x:…") count as defined.
  const PRODUCT = path.join(ROOT, 'scripts/product')
  const productFiles = readdirSync(PRODUCT).map((f) => path.join(PRODUCT, f))
  const tokenSources = ['tokens.paperclip.css', 'tokens.passioncode.css', 'tokens.app.css'].map((f) => readFileSync(path.join(TOKENS_DIR, f), 'utf8'))
  const known = new Set([...tokenSources, ...productFiles.map((f) => readFileSync(f, 'utf8'))].flatMap((s) => [...s.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1])))
  let mockupHits = 0
  for (const f of productFiles.filter((f) => f.endsWith('.css'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (COLOUR.test(line)) { fail(`${rel(f)}:${i + 1} raw colour in a mockup stylesheet — use a token`); mockupHits++ }
      const stock = line.match(/var\(--(bg|surface|surface-quiet|ink|muted|border|border-strong|accent|accent-ink|info|danger|warn|idle|good)\)/)
      if (stock) { fail(`${rel(f)}:${i + 1} --${stock[1]} is a pack colour — mockups consume the --app-*/--state-* roles, like components`); mockupHits++ }
      for (const m of line.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        if (!known.has(m[1])) { fail(`${rel(f)}:${i + 1} ${m[1]} is defined by no token file and set by no renderer`); mockupHits++ }
      }
    })
  }
  if (mockupHits === 0) ok('mockups: every colour is a token and every variable is defined')

  // Focus has its own role: gold fill is action and selection, and on the light
  // theme raw gold does not separate from white, which is why PassionCode names
  // --pc-focus separately. Any outline drawn for :focus must use --app-focus.
  let focusHits = 0
  const styleSheets = [...productFiles.filter((f) => f.endsWith('.css')),
    path.join(TOKENS_DIR, 'components.css'), path.join(TOKENS_DIR, 'styles.css')]
  for (const f of styleSheets) {
    for (const m of readFileSync(f, 'utf8').matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/:focus(-visible|-within)?\b/.test(m[1])) continue
      const colour = m[2].match(/outline:\s*\d+px\s+\w+\s+var\((--[a-z0-9-]+)\)/)
      if (colour && colour[1] !== '--app-focus') { fail(`${rel(f)}: ${m[1].trim().slice(-60)} draws focus with ${colour[1]} — use --app-focus`); focusHits++ }
    }
  }
  if (focusHits === 0) ok('focus: every focus outline uses --app-focus')

  // A page that inlines the app aliases without the design system they name
  // renders with every colour role undefined — silently. Every script that
  // reads tokens.app.css must read tokens.passioncode.css too.
  const scriptFiles = walk(path.join(ROOT, 'scripts')).filter((f) => /\.(mjs|cjs|js)$/.test(f) && f !== path.join(ROOT, 'scripts/check-design.mjs'))
  const orphans = scriptFiles.filter((f) => { const s = readFileSync(f, 'utf8'); return s.includes('tokens.app.css') && !s.includes('tokens.passioncode.css') })
  for (const f of orphans) fail(`${rel(f)} inlines tokens.app.css without tokens.passioncode.css — its colour roles would be undefined`)
  if (!orphans.length) ok('passioncode: every page that inlines the app aliases also inlines the design system')

  // Naming the file in a script is not the page receiving it: a builder that
  // reads its inputs by position once shifted the aliases off the page while
  // still listing all three files. So the generated pages themselves are read:
  // the design system must be defined, then the aliases that name it.
  const REPORTS = ['product.html', 'completeness.html', 'adoption.html']
  let reportHits = 0
  for (const name of REPORTS) {
    // Only stylesheet text counts: the same declarations appearing as page text
    // (a signature block once printed the app CSS) style nothing.
    const html = [...readFileSync(path.join(ROOT, 'docs/reports', name), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    const pc = html.indexOf('--pc-bg:'), app = html.indexOf('--app-bg:')
    if (pc < 0 || app < 0 || app < pc) { fail(`docs/reports/${name}: needs the design system (--pc-bg) defined before the app aliases (--app-bg) — found pc ${pc}, app ${app}`); reportHits++ }
  }
  if (!reportHits) ok(`passioncode: ${REPORTS.length} generated pages define the design system before the app aliases`)
}

// ── type and space ─────────────────────────────────────────────────────────
// Only the app's own stylesheet is checked: the pack layer IS the values, and
// vendor CSS (xterm, monaco, fontsource) is not ours to hold to this.
const APP_CSS = path.join(SRC, 'renderer/src/styles.css')
const TYPE_PROP = /(font-size|letter-spacing|line-height)\s*:\s*([^;]+);/g
const SPACE_PROP = /(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?\s*:\s*([^;]+);/g
const ALLOWED_PX = /^(0|1px|2px|6px|12px)$/ // hairlines, dots, carets — stated, not invented
let typeHits = 0
{
  const lines = readFileSync(APP_CSS, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('/*') || line.trimStart().startsWith('*')) return
    for (const m of line.matchAll(TYPE_PROP)) {
      const value = m[2].trim()
      if (value.includes('var(--') || value === 'inherit' || value === 'normal') continue
      fail(`${rel(APP_CSS)}:${i + 1} raw ${m[1]}: ${value} — use a token from tokens.app.css`)
      typeHits++
    }
    for (const m of line.matchAll(SPACE_PROP)) {
      const value = m[3].trim()
      if (value.includes('var(--')) continue
      const parts = value.split(/\s+/)
      if (parts.every((p) => ALLOWED_PX.test(p) || p === 'auto' || p.endsWith('%'))) continue
      fail(`${rel(APP_CSS)}:${i + 1} raw spacing: ${m[0].trim()} — use the --space-* ladder`)
      typeHits++
    }
  })
}
if (typeHits === 0) ok('type + space: every size comes from the token ladders')

// ── strings ────────────────────────────────────────────────────────────────
const enSource = readFileSync(path.join(SRC, 'renderer/src/i18n/en.ts'), 'utf8')
const known = new Set([...enSource.matchAll(/^\s{2}'([^']+)':/gm)].map((m) => m[1]))
if (known.size === 0) fail('strings: the primary registry parsed as empty')
else ok(`strings: ${known.size} keys in the primary registry`)

let unknownKeys = 0
for (const f of shipped.filter((f) => f.endsWith('.tsx'))) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) {
    if (!known.has(m[1])) {
      fail(`${rel(f)} uses an unknown string key: ${m[1]}`)
      unknownKeys++
    }
  }
}
if (unknownKeys === 0) ok('strings: every key used by a component exists')

// ── the component set ──────────────────────────────────────────────────────
// M117's whole point, and the reason the registry is data rather than prose.
//
// Before the set, `styles.css` held ~90 class names for about fifteen concepts,
// because every new screen re-decided what a card was. The palette gate could
// see a raw colour and the strings gate an untranslated word, but nothing could
// see a NINTH way of drawing a panel. This is that check:
//
//   * every class the app's own stylesheets declare is declared in the registry;
//   * every class a component writes is declared by that component;
//   * a class has exactly one owner — the registry test in the suite proves the
//     second half, and this proves the first.
//
// Vendor stylesheets are out of scope for the same reason the type ramp is:
// xterm and monaco are not ours to hold to this.
const REGISTRY = path.join(SRC, 'renderer/src/components/registry.ts')
const APP_SHEETS = [APP_CSS, path.join(SRC, 'renderer/src/components.css')]
let setHits = 0
{
  const reg = readFileSync(REGISTRY, 'utf8')
  // The registry is data: read the strings out of it rather than importing a
  // module, so the gate stays a plain script with no build step behind it.
  const declared = new Set([
    ...[...reg.matchAll(/classes:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']+)'/g)].map((c) => c[1])
    ),
    ...[...reg.slice(reg.indexOf('export const LAYOUT')).matchAll(/^\s+'?([a-zA-Z][a-zA-Z0-9-]*)'?:/gm)].map(
      (m) => m[1]
    )
  ])
  if (declared.size < 20) fail('the component registry parsed as almost empty — the gate would pass on anything')

  for (const sheet of APP_SHEETS) {
    const text = readFileSync(sheet, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('/*') || line.trimStart().startsWith('*')) return
      const selector = line.match(/^([^{}]*)\{/)
      if (!selector) return
      for (const [, cls] of selector[1].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
        if (declared.has(cls)) continue
        // xterm and monaco ship their own class vocabulary; overriding one is
        // integration, not invention, and holding it to our registry would mean
        // declaring somebody else's design system as if it were ours.
        if (/^(xterm|monaco|view-|decorations)/.test(cls)) continue
        fail(
          `${rel(sheet)}:${i + 1} class .${cls} is in a stylesheet and not in ` +
            `components/registry.ts — declare it on the component that owns it, or delete it`
        )
        setHits++
      }
    })
  }
}
if (setHits === 0) ok('component set: every class in the stylesheets is declared by an owner')


// Literal user-visible text in JSX: >Some words< or a quoted placeholder/title.
let literals = 0
const ALLOWED_LITERAL = /^[\s{}()[\]<>/\\|·×—–:,.;#%+\-*=&?!0-9]*$/
for (const f of shipped.filter((f) => f.endsWith('.tsx'))) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
    for (const m of line.matchAll(/>([^<>{}\n]+)</g)) {
      const text = m[1].trim()
      if (!text || ALLOWED_LITERAL.test(text)) continue
      // `=> Promise<void>` is a type annotation, not interface text.
      if (m.index !== undefined && line[m.index - 1] === '=') continue
      fail(`${rel(f)}:${i + 1} literal interface text: "${text.slice(0, 40)}" — use t('…')`)
      literals++
    }
    for (const m of line.matchAll(/\b(placeholder|title|aria-label)=["']([^"'{}]+)["']/g)) {
      fail(`${rel(f)}:${i + 1} literal ${m[1]}: "${m[2].slice(0, 40)}" — use t('…')`)
      literals++
    }
  })
}
if (literals === 0) ok('strings: no literal interface text in components')

// ── the journal, in a person's words ───────────────────────────────────────
//
// The feed rendered the raw event type — `task.note.promoted@1` — into the
// interface. The literal check above could never have caught it: the text
// arrived as DATA, and every gate here reads source. A receipt nobody can read
// is not a receipt, and receipts are how this product asks an operator to check
// an agent's claim rather than believe it.
//
// So every event type a migration REGISTERS must have a sentence, and the check
// runs in both directions. The orphan half matters as much: M112 records that
// "the design gate checks that every key a component USES exists; the reverse is
// unchecked", so a removed feature leaves dead keys and a scenario that now
// lies. Here the reverse is checked, because the two sets have one true size.
//
// It reads the MIGRATIONS rather than the database on purpose: the fast CI tier
// has no stack, and a gate that only runs with one is a gate that runs rarely.
// Verified equal to the database at the time of writing — 38 either way.
{
  const migrations = path.join(ROOT, 'supabase/migrations')
  const registered = new Map() // type -> the migration that registered it
  for (const name of readdirSync(migrations).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(path.join(migrations, name), 'utf8')
    // Only inside an `insert into event_types` statement, so a type merely
    // MENTIONED in a comment or a where-clause is not mistaken for a
    // registration.
    for (const stmt of sql.split(/insert\s+into\s+event_types/i).slice(1)) {
      // Bounded by a line ENDING in `;`, not by the first `;` in the text. The
      // notes beside these rows are prose and several contain a semicolon
      // mid-sentence — cutting there found 16 of 38 types and reported the
      // other 22 as orphan sentences, which is how this comment got written.
      for (const line of stmt.split('\n')) {
        const m = line.match(/^\s*\(\s*'([a-z][a-z0-9._]*@\d+)'/)
        if (m && !registered.has(m[1])) registered.set(m[1], name)
        if (/;\s*$/.test(line)) break
      }
    }
  }

  const en = readFileSync(path.join(SRC, 'renderer/src/i18n/en.ts'), 'utf8')
  const described = new Set(
    [...en.matchAll(/'event\.([a-z][a-z0-9._]*@\d+)'\s*:/g)].map((m) => m[1])
  )

  if (registered.size === 0) fail('no event types were found in any migration — the parser has drifted')
  else {
    const silent = [...registered.keys()].filter((tp) => !described.has(tp))
    const orphans = [...described].filter((tp) => !registered.has(tp))
    if (silent.length)
      fail(
        `${silent.length} event type(s) reach the feed as a machine identifier — ` +
          silent.map((tp) => `${tp} (${registered.get(tp)})`).join(', ')
      )
    else ok(`strings: all ${registered.size} registered event types have a sentence`)

    if (orphans.length)
      fail(`${orphans.length} event sentence(s) describe a type nobody registers — ${orphans.join(', ')}`)
    else ok('strings: and no sentence describes an event that cannot happen')

    // And every type the code APPENDS is registered. Since migration 71 `append_event` refuses an
    // unregistered type at runtime (63/64 had dropped the check, and nothing noticed for a week); this
    // finds the same refusal at commit, for every literal type a write names in source or SQL.
    const appended = new Map() // type -> where
    for (const f of files.filter((x) => /\.(ts|tsx)$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/type:\s*'([a-z][a-z0-9._]*@\d+)'/g)) if (!appended.has(m[1])) appended.set(m[1], rel(f))
    }
    for (const name of readdirSync(migrations).filter((n) => n.endsWith('.sql'))) {
      const sql = readFileSync(path.join(migrations, name), 'utf8')
      for (const m of sql.matchAll(/(?:append_event|ceo_append)\(\s*[^,()]+,\s*'([a-z][a-z0-9._]*@\d+)'/g)) if (!appended.has(m[1])) appended.set(m[1], name)
    }
    const unregistered = [...appended].filter(([tp]) => !registered.has(tp))
    if (appended.size === 0) fail('no appended event types were found — the parser has drifted')
    else if (unregistered.length)
      fail(`${unregistered.length} appended event type(s) are not registered, and append_event refuses them — ` + unregistered.map(([tp, at]) => `${tp} (${at})`).join(', '))
    else ok(`strings: all ${appended.size} event types the code appends are registered`)
  }
}

// ── the registry has no dead rows ──────────────────────────────────────────
//
// M112, and it has been cited five times this session without being closed. The
// gate above checks that every key a component USES exists. THE REVERSE WAS
// UNCHECKED: a removed feature leaves its strings behind, and a string nobody
// renders is a sentence the brand registry still reviews, the locale files still
// carry, and a reader still believes is on a screen somewhere.
//
// DYNAMIC KEYS ARE THE WHOLE DIFFICULTY, and an allowlist of prefixes would be a
// second list to keep current — the exact failure this check exists to catch,
// relocated into the checker. So the prefixes are DERIVED from the code: a
// `t(`board.${…}`)` marks `board.` as reachable, and the set is whatever the
// components actually do.
//
// What it cannot see, said so a pass is not read as more: a prefix used
// dynamically covers every key under it, so a dead `board.zzz` survives. That is
// the price of not keeping a hand-written list, and it is the smaller error —
// the class that bites is a whole feature removed, and its keys do not hide
// under a live prefix.
{
  const en = readFileSync(path.join(SRC, 'renderer/src/i18n/en.ts'), 'utf8')
  const keys = [...en.matchAll(/^\s*'([a-zA-Z][a-zA-Z0-9.@_-]*)':/gm)].map((m) => m[1])

  const sources = walk(SRC)
    // Only the registry itself is excluded, not the i18n directory: `describeEvent`
    // lives beside it and is what resolves every `event.*` key. Excluding the
    // folder reported all thirty-eight of them as dead on the first run.
    .filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('/en.ts'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')

  const literal = new Set(
    [...sources.matchAll(/['"`]([a-zA-Z][a-zA-Z0-9.@_-]*)['"`]/g)].map((m) => m[1])
  )
  // ANY template that interpolates after a key-like prefix, not only one written
  // inside `t(...)`. `describeEvent` builds `event.${type}` into a variable and
  // passes that, which the narrower rule missed — it reported all thirty-eight
  // event sentences as dead. Widening errs towards missing a dead key rather
  // than calling a live one dead, which is the right direction for a gate whose
  // failure blocks a build.
  const prefixes = [
    ...sources.matchAll(/`([a-zA-Z][a-zA-Z0-9.@_-]*\.)\$\{/g)
  ].map((m) => m[1])

  const dead = keys.filter(
    (k) => !literal.has(k) && !prefixes.some((p) => k.startsWith(p))
  )
  if (dead.length)
    fail(
      `${dead.length} registry key(s) nothing renders — a string no component asks for is a ` +
        `sentence the brand registry still reviews and a reader still believes is on a screen: ` +
        dead.join(', ')
    )
  else ok(`strings: all ${keys.length} registry keys are reachable from a component`)
}

// ── the bilingual ratchet (M197) ──────────────────────────────────────────
//
// Bilingual from 2026-09-06: a NEW key lands in en AND ru in the same change.
// The legacy debt is `ru-baseline.txt`, and it may only SHRINK: a translated
// key must be struck from it, a struck key must exist in en, and a key in
// neither ru nor the baseline is a new key someone shipped monolingual. The
// fallback to en makes a missing ru key invisible at runtime, which is exactly
// why a gate exists — silence is where parity goes to die.
{
  const keysOfFile = (f) =>
    [...readFileSync(f, 'utf8').matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1])
  const i18nDir = path.join(SRC, 'renderer/src/i18n')
  const enSet = new Set(keysOfFile(path.join(i18nDir, 'en.ts')))
  const ruSet = new Set(keysOfFile(path.join(i18nDir, 'ru.ts')))
  const baseline = readFileSync(path.join(i18nDir, 'ru-baseline.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const baseSet = new Set(baseline)

  const orphans = [...ruSet].filter((k) => !enSet.has(k))
  if (orphans.length)
    fail(`i18n: ${orphans.length} ru key(s) do not exist in en — a translation of nothing: ${orphans.join(', ')}`)

  const monolingual = [...enSet].filter((k) => !ruSet.has(k) && !baseSet.has(k))
  if (monolingual.length)
    fail(
      `i18n: ${monolingual.length} new key(s) shipped in en only — bilingual from 2026-09-06, ` +
        `a new key lands in BOTH registries in the same change: ${monolingual.join(', ')}`
    )

  const translated = baseline.filter((k) => ruSet.has(k))
  if (translated.length)
    fail(
      `i18n: ${translated.length} baseline row(s) are already translated — the ratchet only shrinks, ` +
        `strike them from ru-baseline.txt: ${translated.slice(0, 6).join(', ')}${translated.length > 6 ? ', …' : ''}`
    )

  const ghosts = baseline.filter((k) => !enSet.has(k))
  if (ghosts.length)
    fail(`i18n: ${ghosts.length} baseline row(s) name keys en no longer has: ${ghosts.slice(0, 6).join(', ')}`)

  if (!orphans.length && !monolingual.length && !translated.length && !ghosts.length)
    ok(
      `i18n: bilingual ratchet holds — ru covers ${ruSet.size}/${enSet.size} keys, ` +
        `${baseSet.size} in the shrinking baseline, no monolingual additions`
    )
}

// ── a figure opens the register it was counted from ───────────────────────
//
// M142's rule, and the way it decays. `evidence.ts` lists every section a figure
// may open, and the union type stops a typo — but a name spelled correctly and
// rendered NOWHERE type-checks perfectly and produces a pressable number that
// does nothing. That is worse than the unpressable figure it replaced, because
// the interface now makes a promise it visibly keeps failing.
//
// So the list is held equal to the ids the screens actually render. Not the
// reverse: a panel may carry an id without any figure pointing at it, and
// demanding otherwise would turn a navigation aid into a quota.
{
  const ev = readFileSync(path.join(SRC, 'renderer/src/evidence.ts'), 'utf8')
  const block = ev.match(/EVIDENCE_ANCHORS = \[([\s\S]*?)\]/)
  if (!block) fail('evidence.ts: EVIDENCE_ANCHORS could not be read — the parser has drifted')
  else {
    const declared = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    const rendered = new Set()
    for (const f of walk(SRC).filter((x) => x.endsWith('.tsx')))
      for (const m of readFileSync(f, 'utf8').matchAll(/\bid="(sec-[a-z0-9-]+)"/g))
        rendered.add(m[1])

    const dead = declared.filter((a) => !rendered.has(a))
    if (dead.length)
      fail(
        `${dead.length} evidence anchor(s) are declared and rendered nowhere — ` +
          `a figure pointing at one is pressable and does nothing: ${dead.join(', ')}`
      )
    else ok(`evidence: all ${declared.length} anchors name a section the screens render`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} design/i18n gate failure(s)`)
  process.exit(1)
}
console.log('\nPASS: interface tokens and strings')
