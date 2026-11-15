# Fabric bug tracker: errors, crashes, hangs, slow operations and reported problems

Status: design, 2026-11-15. No code changed. Source tree read: `/Users/example/DATA/_worktrees/fabric-0321-i3r4`
at `819b4bc7` (read-only). Line numbers below are at that commit; the code should cite symbols when this lands.

Operator's words (2026-11-15): «Добавь также баг-трекер, чтобы корректно собирать всю аналитику. У нас есть наша
собственная аналитика, и надо собирать с ней, подключая какие-то сторонние ... какие-то проблемы, вопросы».
Read as: capture errors, crashes, hangs and slow operations, plus problems and questions a person reports, through our
own analytics first; a third-party tracker only where ours cannot do the job.

Vision alignment: serves the operator's ability to see what breaks for people using Fabric (observability of the
product itself, ADR-0188 line of work). No conflict found with the anti-vision; the person-facing part is one menu item
and one form.

## 1. What exists (with evidence)

### 1.1 Capture inside the app

| Signal | Where it is caught | Where it goes |
|---|---|---|
| Main process `uncaughtException`, `unhandledRejection` | `apps/desktop/src/main/index.ts:1018-1019` (`ops.failed('process.uncaught-exception' / 'process.unhandled-rejection')`) | local ops log only |
| Renderer render errors, root `onUncaughtError`, window `error` and `unhandledrejection` | `apps/desktop/src/renderer/src/main.tsx:28-36`, `CrashBoundary.tsx:21-34` (`reportRendererError`), IPC `opsRendererError` in `preload/api.ts:217` | `main/index.ts:4884-4886` writes `renderer.error` with the message, a stack and the component stack into `detail` (capped at 600 chars by `shared/opsLog.ts` `cap`, redacted for secrets, but a renderer stack carries `file://` paths) |
| Renderer process gone (crash, OOM, killed) | `main/index.ts:6458-6465` (`window.renderer-gone`, reload policy in `rendererRecovery.ts`) | local ops log |
| Renderer hang | `main/index.ts:6466-6467` (`window.unresponsive`, `window.responsive`) | local ops log |
| Slow operations | `main/ops.ts:45-59`: a call slower than `SLOW_MS` (1 s) is always written with its `ms` | local ops log only; the digest counts outcomes, not durations |
| Startup failure | `main/index.ts:6068`, `:6143`, `:6361` (`startup-failure.log`, bounded by `main/boundedLog.ts`) | local file (532 lines on this Mac today) |
| Every ops record, counted | `main/opsDigestRun.ts`, `shared/opsDigest.ts` (`ops.digest.hourly@1`, `ops.digest.daily@1`) | `userData/digests/*.jsonl`; a rise of failures (`RISE_MIN_FAILED` 10, `RISE_FACTOR` 2, `shared/opsDigest.ts:46-49`) becomes a «На проверке» row (`risenRows`, `shared/opsDigest.ts:116`, used at `main/index.ts:3758`) |
| Daily digest to Observatory | `main/opsDigestSend.ts:22-67` (`ops_digest_record`, hourly pass) | only when `userData/observatory/ops-digest-binding.token` exists |

Redaction: `shared/opsLog.ts` header (lines 22-29) runs `shared/redact.ts` over detail and error message (rules
`private-key`, `bearer`, `openai-key`, `github-token`, `jwt`, `url-password` and others, `redact.ts:96-231`) and drops
`error.stack`. Paths are not a redaction rule: they stay in the local log by design (ADR-0188 decision 1: "it holds
paths and identifiers that are the person's").

### 1.2 Usage analytics (ours)

- `main/analytics.ts`: Aptabase at `analytics.passioncode.ai`, batches of 25 (`BATCH_MAX`, line 31), at most 200 in
  memory (`QUEUE_MAX`, line 32), `track` at line 222. Props pass `cleanProps` (lines 112-121): keys
  `^[a-z][a-z0-9_]{0,39}$`, finite numbers, booleans, and strings only from `KNOWN_KINDS` (lines 105-111).
- Consent: ADR-0127 (`docs/adr/0127-no-usage-count-leaves-before-the-person-has-answered-the-switch.md`, Decision 1-6):
  nothing is queued or sent until the person answered the switch once; the switch is the shared
  `PassionCode/installation.json` `analytics` field.
- Events sent today: `app_installed`, `app_started`, `app_active` (`docs/ANALYTICS.md`, "What is sent").
- Growth registry: `fabric` is registered with analytics connected (`growth.apps.list`, 2026-11-15). Production,
  2026-10-16 to 2026-11-15: `app_started` 88, `app_active` 38, `app_installed` 2 (`growth.analytics.events.list`,
  receipt `urn:sshlg-growth:query:7b7cd9cd...`). No error event exists for Fabric.

### 1.3 The family's precedent

- Fabric Inbox sends `app_error` (`where`, `code`, once per launch per pair; `fabric-inbox/docs/ANALYTICS.md:66`) and
  `server_error` (`class`, `code`, `count`, `day`; line 67). Growth shows `app_error` 76 events in 30 days, all
  `where=utility`, `code=killed` (`growth.analytics.events.list` for `fabric-inbox`, receipt
  `urn:sshlg-growth:query:6c3c57f0...`). That one pair looks like helper processes killed on quit: noise, a lesson for
  Fabric (section 2.3).
- Fabric Switchboard sends `app_error` once a UTC day is over: one event per `class` and `code`, `count`, `day`, at most
  30 a day (`fabric-switchboard/docs/ANALYTICS.md:117`, SB-248, lines 132-163). This shape is growth's own answer
  (board thread `b2e5df1f`, message `891c4748`, cited in `fabric-inbox/docs/app-store/tasks/2026-11-04-server-error-counts.md`):
  growth's `where` filters read string properties, so one event per pair.
- The two siblings disagree on the property name (`where` vs `class`). Fabric follows growth's answer (`class`) and the
  difference goes to the analytics agent (wave 0).

### 1.4 Board and GitHub

- A task can be linked to a backlog row: `task_sources` (`supabase/migrations/20261011000095_work_claims.sql:75-89`,
  index `task_sources_row (estate_id, repo_path, path, row_id)`, not unique). `task.created@1` is written by the agent
  surface (`main/agentSurface.ts:2181`) and by internal writers such as `assignDeps().fileTask` (`main/index.ts:6214-6217`).
- No GitHub issue path exists in the main process (grep of `api.github.com`, `gh ` in `apps/desktop/src/main`: none).
- No support channel exists in `docs/brand/facts.md` or the menus (`main/menu.ts`, `menuTemplate.ts`).

### 1.5 Third party available today

- `sentry` CLI 0.43-line at `/opt/homebrew/bin/sentry`, authenticated as the operator, token expires 2026-11-19
  (`sentry auth status`). A personal Sentry org with 10 projects of several businesses. No
  Fabric or PassionCode project. Two of these belong to sides that must never share data with Fabric's estate
  (the operator's separation rules), so a Fabric project, if ever made, does not go into this personal org unseparated.
- Observatory holds no Sentry credential for `fabric` (`observatory_credentials fabric`, 2026-11-15).

## 2. What is lost today

Measured on this Mac from `userData/digests/daily-2026-11.jsonl` (counts only): 10 days, 13,218 failed and 545 unknown
outcomes across all operations (2026-11-11: 2,718 failed; 2026-11-12: 6,896). Among them `startup.bootstrap` failed 3,
`window.renderer-gone` 1. None of it left the machine:

1. **Nothing reaches our analytics.** Fabric sends no error event; growth sees 0 errors while the operator's own Mac
   logged thousands. Every other install is invisible.
2. **The Observatory digest does not leave either:** `ops-digest-binding.token` is absent on this Mac, so
   `opsDigestSend.ts` sends nothing (by design it says so once in the ops log).
3. **Native crashes are not captured at all.** No `crashReporter.start`, no `app.on('child-process-gone')` (grep for
   `crashReporter|child-process-gone|Crashpad` in `apps/desktop/src`: none). A main-process segfault, a GPU process
   crash, a utility process (node-pty, network service) death leave no record; Electron's default Crashpad dumps are not
   enabled.
4. **A main-process hang is invisible.** Only the renderer's `unresponsive` is recorded. A blocked main event loop (a
   sync `fs` call, a long JSON parse) freezes every window and no record says so.
5. **Slow is local only.** `ms` lands in the log, the digest keeps only outcome counts; no p95, no trend.
6. **The local evidence is short-lived.** The ops log rotates an 8 MB segment every 5 to 10 hours here; the oldest
   segment on disk is from 2026-11-11 22:50, so about 3.3 days are kept against the 7 the budget is sized for
   (`ops.ts:30-43`). A crash reported on Monday about Thursday has no lines left.
7. **No dedup.** The same `TypeError` in a 15-second poller is thousands of lines; nothing groups it into one thing a
   person or agent can own. «На проверке» shows only rises (`failures-rose:<op>`), keyed by op, not by cause.
8. **A person has no way to report a problem or ask a question** from inside Fabric.

## 3. Design

### 3.1 Principles

- Ours first: counts and fixed codes go to our Aptabase (growth reads them) and to Observatory's daily digest. The
  local ops log stays the full-detail record on the machine.
- Nothing free-form leaves the machine automatically: no message text, no stack, no path, no project or agent name, no
  person text. A person's report leaves only when the person presses Send, and shows what it carries first.
- Same consent switch as usage (ADR-0127), extended by an amendment (section 3.3).
- Never rename an event (global-24); every new event and property is in a catalogue with a test (section 5, wave 1).
- One bug is one row: a fingerprint groups occurrences locally; the aggregate key `class/code` groups them across
  installs.

### 3.2 Events (all new in Fabric; nothing renamed or redefined)

| Event | When | Props (besides the ids every event carries: `install_id`, `iid`, `environment`) |
|---|---|---|
| `app_error` | once a UTC day is over (first analytics pass after midnight UTC), one event per `class` and `code` counted that day, largest first, at most 30 a day; a day older than 7 days is dropped unsent | `class`, `code`, `count` (number), `day` (`YYYY-MM-DD`). Same shape and name as Switchboard (SB-248) |
| `app_crash` | at the next start after an abnormal end of a Fabric process, once per crash, at most 5 per start | `class` (`main`, `renderer`, `gpu`, `utility`, `pty_host`), `reason` (Electron's fixed `details.reason`: `crashed`, `oom`, `abnormal-exit`, `launch-failed`, `integrity-failure`, `killed`), `minidump` (boolean: a Crashpad dump exists locally) |
| `app_hang` | once per UTC day is over, one per class, as `app_error` | `class` (`renderer_unresponsive`, `main_event_loop`), `count`, `longest_s` (number, rounded), `day` |
| `app_slow` | once per UTC day is over, one per operation family that crossed its budget, at most 20 a day | `code` (operation family, from a fixed table), `count` (calls over budget), `p95_bucket` (`1_3s`, `3_10s`, `10_30s`, `over_30s`), `day` |
| `problem_reported` | the person pressed Send in «Сообщить о проблеме» | `kind` (`problem`, `question`, `idea`), `diagnostics` (boolean), `from` (`menu`, `crash_screen`, `history`) |

Why `app_crash` is separate from `app_error`: a crash is a different meaning (the process died) and needs to arrive
the next start, not a day later; global-24 rule 4, new meaning, new event.

Value sets (each a `KNOWN_KINDS`-style allowlist in code, `cleanProps` unchanged in behaviour, the new values added):

- `class` for `app_error`: `main`, `renderer`, `startup`, `hub`, `board`, `dispatch`, `stack`, `sweep`, `mcp`,
  `pty`, `analytics`, `digest`, `other`. Derived from the ops op's first segment through a fixed map
  (`process.*` to `main`, `renderer.*` to `renderer`, `startup.*` to `startup`, `hub.*` and `tool.*` to `hub`,
  `board.*` to `board`, ...). An unknown prefix is `other`, never the raw prefix.
- `code`: the ops op name itself, when it is in the generated op allowlist (wave 1 builds it from the literal
  `op:` strings in `apps/desktop/src/main`, checked by a test); else `other`. Op names are code identifiers
  (`hub.session.enroll`), never data. The regex `^[a-z][a-z0-9_.:-]{0,63}$` is checked again on send.
  The Aptabase `code` string is therefore a fixed vocabulary, which is what `cleanProps` requires.
- Error name is folded into `code` only for `renderer.error` and `process.*`: `renderer.error.TypeError`, from a fixed
  list (`Error`, `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `AbortError`, `DOMException`, `other`).

Noise rules (the Inbox lesson): a `child-process-gone` or `render-process-gone` with reason `killed` or `clean-exit`
while `quit.quitting` is true, or within 10 s of a `powerMonitor` `suspend`, is not counted. Failures that are answers
(a refused enrollment the person decides, a `stack-starting` 503) are counted as `unknown`, not `failed`, as the op
already records them; only `failed` outcomes feed `app_error`.

### 3.3 Consent

- Same switch, same file, same disclosure state (ADR-0127). Nothing is counted for sending while the status is
  `pending-disclosure`; counting into the local file happens regardless (it is the ops digest, already local).
- The disclosure text changes from usage counts to "usage and error counts": proposed copy for the notice and Settings
  (to be run through the copywriting rules and `the copy check` ru and en in wave 2): «Fabric отправляет счётчики
  использования и ошибок: сколько раз и где что-то сломалось, без текста ошибок, путей и имён.»
- ADR-0127 amendment 4 (new ADR id reserved through agent-sync in wave 2): an install that answered before error counts
  existed has `disclosed_at` but no `errors_disclosed_at`; it sees the notice once more, and error events wait until it
  answers. Off at that notice keeps usage counts on only if the person chooses it: the notice offers one switch for both
  (simplest; two switches is more choice than the person asked for). This mirrors Switchboard's single notice
  (`fabric-switchboard/docs/ANALYTICS.md:33-37`).
- `problem_reported` and the report itself are per-send consent: the form shows exactly what will be sent.

### 3.4 Privacy and redaction

- Aptabase events carry only the fixed vocabularies above, numbers and booleans. The existing planted-identifier
  test (`apps/desktop/test/analytics.test.mjs`, "events carry counts and the installation id, never a planted name,
  path, e-mail or id") is extended: an error whose message holds a path, an e-mail, a token and a project name, and an
  op name built from user data, must produce only `code: other` and none of the planted strings on the wire.
- The fingerprint (3.5) is a hash and never leaves through Aptabase (analytics agent rule: no identifiers or codes in
  enumerated values). It may appear on the board and in a GitHub issue, which are inside the estate.
- Renderer stacks: `main/index.ts:4885` stores the renderer stack in `detail.stack` with `file://` paths. Wave 1 keeps
  the stack in the local log (it is the person's machine) but normalizes it for fingerprinting: function names only,
  bundle chunk hashes stripped (`index-3f9a1c.js` to `index.js`), no directories.
- Person reports (3.7): the text is the person's; the attached diagnostics are built from the digest and the
  fingerprints, not from raw log lines; raw lines are attached only when the person ticks "attach the last log lines",
  and then after `redact.ts` plus a path rule that turns `/Users/<name>/` and `C:\Users\<name>\` into `~/`.
- Two-layer scrubbing (error-tracking skill, "The one that actually leaks"): applies to any third party (3.9); for our
  own pipeline the layers are `cleanProps` (keys and values by allowlist) and `redact.ts` (values).

### 3.5 Fingerprint and dedup

`fp = sha256("fabric-bug/1|" + class + "|" + code + "|" + errorName + "|" + messageTemplate + "|" + frames).slice(0, 12)`

- `messageTemplate`: the message with numbers, hex runs, UUIDs, quoted strings, URLs and anything path-shaped replaced
  by placeholders (`<n>`, `<hex>`, `<id>`, `<s>`, `<url>`, `<path>`), then lowercased, cut at 200 chars. Computed
  locally and only hashed.
- `frames`: the first three stack frames' function names (anonymous ones skipped), from the main or renderer stack;
  empty for errors with no stack.
- Not in the hash: the version (a bug survives a release), the time, the session, the project.
- Local store: `userData/bugs.json` (0600), at most 200 fingerprints, each `{fp, class, code, errorName,
  messageTemplate, firstSeen, lastSeen, count, versions[], lastLogCorrelationId}`; older-than-30-days and the rarest
  dropped first. Written on the digest's hourly pass, not per error.
- Aggregate key across installs: `class/code` (what Aptabase carries). One local fingerprint maps to one `class/code`;
  a `class/code` may hold several fingerprints (seen on the operator's machine only).

### 3.6 Where each signal goes

| Signal | Local ops log | Local `bugs.json` | Ops digest (hourly, daily) | Observatory (daily digest) | Aptabase / growth | Board («На проверке», task) | GitHub issue |
|---|---|---|---|---|---|---|---|
| Error (`failed` outcome) | yes (today) | by fp | yes (today) | yes, once the binding token exists | `app_error` daily counts | a new fp seen 3 times, or any fp in `main`/`startup` class: one «На проверке» item `bug:<fp>`; «Сделать задачей» files one task | from growth aggregate (3.8) |
| Crash (process gone, native) | yes, plus `crash.<class>` op | by fp `crash/<class>/<reason>` | yes (new ops `crash.*`) | yes | `app_crash` next start | always an item; repeated 2 times in a day: a task | yes |
| Hang | yes (renderer today; main new) | by fp `hang/<class>` | yes (new ops `hang.*`) | yes | `app_hang` daily | when longest over 30 s | when across installs |
| Slow | yes (`ms`, today) | no | yes (new ops `slow.<op>`, outcome `unknown`) | yes | `app_slow` daily | a family whose p95 doubled week over week | no |
| Person report | a line `problem.reported` (no text) | no | counted | counted | `problem_reported` | a task with the text, on the person's own board | on the operator's estate only, if the person chooses |

Board specifics:

- «На проверке» item kind `bug`, key `bug:<fp>` (same mechanism as `failures-rose:<op>`, built like `risenRows`),
  title `<class>/<code>: <n> за сутки, версии <...>`; never the message text (it may hold a name), the template is shown
  on the item's detail only on this machine.
- «Сделать задачей» writes one `task.created@1` in the project `fabric` when it exists in the estate, else in the
  project the person picks, with `task_sources` `(repository: passioncode-ai/fabric, path: docs/evidence/bugs.md,
  row_id: BUG-<fp>)`. Before filing, a read of `task_sources` by `(repo_path, path, row_id)` finds an existing task: if
  open, a note `task.note.added@1` with the new counts is appended instead; if closed, a new task is filed and linked
  `follows` the closed one (a regression). Idempotency key `bug:<fp>:<YYYY-MM-DD>` so a retry never files twice.
- `docs/evidence/bugs.md` is the backlog source declared in `docs/backlog-sources.json` (so the shared backlog
  publishes it); the operator's Fabric writes the row only through the repository's normal route (an agent session
  under the lease), never from the app. The app links to the row id; the row is created by the triage agent (3.8).

### 3.7 «Сообщить о проблеме»

Entry points: Help menu item «Сообщить о проблеме…» (`main/menuTemplate.ts`), a button on the crash screen
(`CrashBoundary.tsx`, beside «Назад»), and a link at «Журнал Fabric и версия» on История (`HistoryScreen.tsx#OpsLog`).

The form (one modal, no new screen):

1. What happened: three choices, «Проблема», «Вопрос», «Идея».
2. Text area, required, up to 4,000 characters.
3. «Приложить диагностику» (on by default), with «Показать, что будет отправлено» expanding the exact JSON: version,
   OS, environment, the last 7 days' `app_error`/`app_crash`/`app_hang` counts, the fingerprints of the last 10 bugs
   with their templates, the stack's health state. A second, off-by-default box: «Приложить последние строки журнала»
   (the last 200 lines of the ops log, redacted as in 3.4).
4. Where it goes, shown before Send:
   - Always: a task on the person's own board (their project `fabric`, or a picked project), with the text and the
     diagnostics as the brief. This needs no network and no third party.
   - When the person also ticks «Отправить в PassionCode»: the report is posted to PassionCode's intake. There is no
     intake today (section 1.4). Proposed: a `POST /api/reports` route on the PassionCode site's existing form
     infrastructure (Cloudflare D1, form token and IP-hash salt already held by `passioncode-ai.github.io` in
     Observatory), owned by passioncode-platform; asked through the board in wave 0. Until it exists, the checkbox is
     not shown.
   - On the operator's own estate (the person is the operator, the estate holds `passioncode-ai/fabric`): «Создать
     issue в GitHub» through the triage route (3.8), not from the renderer.
5. After Send: a receipt line (task id, and the intake's id when sent), and `problem_reported` counted.

Questions (kind «Вопрос») go to the same task; a later wave can route them to the CEO agent's conversation, out of
scope here.

### 3.8 Triage across installs: from growth to one GitHub issue per bug

Fabric clients never hold a GitHub token. The aggregate lives in growth; one job on the operator's machine turns it
into issues:

- Owner: a Fabric routine on the operator's estate (or the analytics agent's watcher, decided in wave 0 with the
  analytics agent; it already lists anomalies, `analytics.findings.list`). Daily after 01:00 UTC.
- Reads `growth.analytics.stats.get` for `app_error`, `app_crash`, `app_hang` of `fabric`, production, grouped by
  `class` and `code` (`where` filters on string properties), and the per-version split from Aptabase's app version.
- Opens or updates one issue per `class/code` in `passioncode-ai/fabric` with `gh` under the operator's own
  authentication: label `bug:auto`, title `[app_error] <class>/<code>`, a hidden marker `<!-- fabric-bug:<class>/<code> -->`
  for dedup (`gh issue list --label bug:auto --state all --search "<class>/<code> in:title"`), a body with installs,
  counts per day and per version, and the local fingerprints the operator's own Mac holds for that pair. A closed issue
  that receives new counts on a newer version is reopened with a "regressed in <version>" comment.
- Thresholds: a crash on 1 install opens an issue; an error opens one at 3 installs or 50 a day; at most 5 new issues
  a day, the rest listed in one daily summary comment.
- Writes the `docs/evidence/bugs.md` row `BUG-<fp>` (or `BUG-<class>-<code>` for aggregate-only bugs) under the agent-sync
  lease, linking the issue, so the board task and the issue meet on one row id.

### 3.9 Third party: what ours cannot do, decided by the error-tracking skill

What our stack cannot do: symbolicate native crash minidumps (Crashpad `.dmp` from main, GPU or utility processes) and
group them by native stack. Aptabase takes events with flat props; Observatory takes counts. Everything else (JS
errors, renderer and main exceptions, hangs, slow) is counts plus local fingerprints, which our stack carries.

Decision:

1. Waves 1 to 5 add no third party. Native crashes are captured locally (`crashReporter.start({ uploadToServer: false })`)
   and counted as `app_crash` with `minidump: true`; the dump stays on the machine and can be attached to a person's
   report only when the person ticks it.
2. Wave 6 (optional, an operator decision because it sends data to a party outside the estate and changes the
   disclosure): Sentry, used only as the minidump endpoint of Electron's `crashReporter`
   (`submitURL` = the project's minidump URL derived from its DSN), not the JavaScript SDK. Reasons from the skill:
   - The account and CLI already exist and are authenticated (skill: "Called get a DSN a manual human step"); a project
     is created with `sentry project create <org>/fabric:electron --dry-run` first.
   - A DSN is write-only ingest and may live in the built app (skill, "A DSN is not an auth token"); it is set at build
     time like `FABRIC_ANALYTICS_APP_KEY` (`electron.vite.config.ts` `define`), from the release environment's secret,
     so source builds send nothing.
   - Releases tied to commits: the release string is `fabric@<version>`, identical in `crashReporter` `extra.release`
     and in `sentry release create`, followed by `set-commits --auto` and upload of the macOS `.dSYM` and Electron
     symbols; release bookkeeping is non-fatal in `scripts/release-mac.mjs` (skill, "Releases, or the stack trace names
     nothing").
   - Two-layer scrubbing: minidumps carry memory, not strings we control; `crashReporter` `extra` fields are limited to
     `release`, `environment`, `process_type` and the install id hash, nothing else, checked by a test that inspects the
     upload form fields.
   - Org: not the personal `sshlg` org, which holds projects of sides that must stay separate from Fabric; a
     PassionCode organization (the product's owner) or its own project with restricted team, decided by the operator.
   - Cost (not verified today, read the pricing page before deciding): Sentry's free Developer tier has historically
     covered about 5,000 errors a month for one user; Fabric's install base (2 `app_installed` in 30 days, 88 starts)
     makes native crashes a handful a month, so the free tier is expected to suffice. No spend is proposed.
3. Rejected: the full `@sentry/electron` SDK for JS errors. It would send messages and stacks (strings we would then
   have to scrub twice) for a job our counts plus fingerprints already do, and would add a second source of truth for
   errors beside growth.

### 3.10 Hangs and slow operations (capture details)

- Main event loop: `perf_hooks.monitorEventLoopDelay({ resolution: 20 })` read every 10 s; a `setInterval` heartbeat
  that records `hang.main_event_loop` when the gap between beats exceeds 2 s (with `longest_s`), and a sleep guard from
  `powerMonitor` (`suspend`/`resume`) so a sleeping Mac is not a hang.
- Renderer: the existing `unresponsive`/`responsive` pair (`main/index.ts:6466-6467`) gains its duration, recorded as
  `hang.renderer_unresponsive` with `ms` when `responsive` follows.
- Slow: `createOps` already passes `ms` to every record; its `observe` callback (`main/ops.ts`, `observe?: (op,
  outcome, at)`) gains `ms`, and the digest counts `slow.<family>` when `ms` exceeds the family's budget (a fixed table:
  `ipc.*` 1 s, `hub.*` 2 s, `board.*` 5 s, `stack.*` 15 s, `dispatch.*` 60 s). The daily fold keeps a histogram per
  family in four buckets so `p95_bucket` is computed without keeping samples.

## 4. Open questions decided (by the rules: operator's decisions, then the project's goal, then the safest reversible option)

| Question | Decision | Why |
|---|---|---|
| `class` or `where` | `class` | growth's answer of 2026-11-04 and Switchboard; Inbox difference reported to the analytics agent |
| Error text to analytics | never | `docs/ANALYTICS.md` "Never sent", ADR-0127, global-24 amendment 4 |
| Fingerprint to Aptabase | never | analytics agent rule against identifiers or codes in enumerated values |
| Third party now | none until wave 6, minidumps only | ours covers everything but native symbolication |
| One switch or two | one switch, one renewed notice | simplest; Switchboard precedent |
| Who opens GitHub issues | one job on the operator's machine from growth | clients hold no token; issues dedup on `class/code` |

## 5. Implementation plan (small waves, TDD, each wave green on `bash scripts/ci.sh fast`, design map entry, `docs/MERGES.md` in the same change)

**Wave 0. Agreements (no code).**
- Board request to the analytics agent (`analytics.guidance`): the five new events, value sets, catalogue diff, and
  the `where` vs `class` divergence. Board request to passioncode-platform: the report intake route. Board note to
  fabric-workspace (North Star, G-row it moves). Record the Observatory ops-digest binding token issuance as a step
  (the binding is the operator's access binding; issue it through Observatory's door, ADR-0188 §3).
- Files: none in the repo; the answers are cited in wave 1's catalogue.

**Wave 1. Local capture and fingerprints (nothing new leaves the machine).**
- `apps/desktop/src/shared/bugFingerprint.ts` (new): `messageTemplate`, `frameNames`, `fingerprint`. Tests:
  `apps/desktop/test/bugFingerprint.test.mjs`: the same bug with different numbers, paths, ids and versions gives one fp;
  different top frames give two; a planted path, e-mail and token never appear in the template.
- `apps/desktop/src/main/bugStore.ts` (new): `userData/bugs.json`, caps, prune. Tests with a temp dir, corrupt file,
  no permission (never throws, like `ops.ts`).
- `main/index.ts`: `crashReporter.start({ uploadToServer: false, compress: true })` before `app.whenReady`;
  `app.on('child-process-gone')` recording `crash.<class>`; `render-process-gone` also records `crash.renderer`;
  noise rules (quit, suspend). `main/hangWatch.ts` (new) for the main loop. Test: a planted `killed` during quit is not
  counted (planted defect watched).
- `main/ops.ts`: `observe` gains `ms`; `shared/opsDigest.ts`: `slow.<family>` and bucket counts in the hour, folded by
  day. Existing digest tests keep passing; DEC-0153 OD-2 regex check on the new names.
- Gate: `node scripts/check-regions.mjs` (new code fenced in a `bug-tracker` region marker, in the format AGENTS.md gives, pointing at this design's landed path).

**Wave 2. Consent and disclosure.**
- ADR (id reserved via `agent_sync.py reserve ADR`): ADR-0127 amendment 4, error counts.
- `main/analytics.ts`: `errors_disclosed_at` in `analytics-state.json`; status `pending-disclosure` for error events
  until answered. `UsageCountsNotice.tsx`, `UsageCountsSetting.tsx`, `i18n/ru.ts`, `i18n/en.ts` texts through the
  copywriting rules and `the copy check` (ru, en). Tests: the existing four `A7-012:` tests extended; a 0.3.21 state with
  `disclosed_at` and no `errors_disclosed_at` sees the notice and sends no error event before the answer.

**Wave 3. Error events to our analytics.**
- `main/errorCounts.ts` (new, the Switchboard shape): daily counts per `class/code` from the digest's daily fold (no
  second counter), `app_error`, `app_hang`, `app_slow` sent on the first pass after the UTC day ends, caps 30/20, a day
  older than 7 dropped. `app_crash` at the next start from the `crash.*` records of the previous run.
- `main/analytics.ts` `KNOWN_KINDS`: the new value sets; the op allowlist generated by `scripts/gen-op-allowlist.mjs`
  (new) with a check in `scripts/ci.sh` that the list matches the literal `op:` strings.
- `docs/ANALYTICS.md`: the five events in "What is sent", the event catalogue section (event, status live, file:line,
  props, values, date). Test `apps/desktop/test/analyticsCatalogue.test.mjs` (new): emits found in code equal the
  catalogue (global-24 rule 7).
- Tests: planted identifiers (path, e-mail, token, project name, op built from user text) never reach the synthetic
  Aptabase server; switch off sends nothing and clears pending counts.

**Wave 4. Board items and tasks.**
- `shared/opsDigest.ts` or `shared/bugRows.ts` (new): `bugRows(bugs)` producing `bug:<fp>` items beside `risenRows`
  (`main/index.ts:3758`); `shared/attention.ts` kind `bug`.
- «Сделать задачей»: `main/bugTask.ts` (new) with the `task_sources` lookup, note-or-file logic and idempotency key;
  i18n feed sentence for any new event type (narrative gate). Tests: two occurrences on one day file once; a closed task
  gets a `follows` task; a refused store read leaves the item and logs `bug.task-file`.
- UX chain: `docs/ux/scenarios.md` new SCN for «Сообщить о проблеме» and the bug item, `docs/ux/product-model.json`,
  `node scripts/sync-product-ux.mjs`, `node scripts/build-product-report.mjs`.

**Wave 5. «Сообщить о проблеме».**
- `renderer/src/launch/ReportProblem.tsx` (new modal), entry points in `main/menuTemplate.ts`, `CrashBoundary.tsx`,
  `HistoryScreen.tsx#OpsLog`; IPC `problem.report` in `preload/api.ts`, `shared/types.ts`, handler in `main/index.ts`
  that builds the diagnostics JSON (`main/problemReport.ts`, new) and files the task. Tests: the preview equals what is
  stored; a planted path in log lines becomes `~/`; with diagnostics off nothing but the text is stored; `problem_reported`
  carries only `kind`, `diagnostics`, `from`.
- PassionCode intake checkbox only when wave 0's intake exists (feature flag read from settings).
- The triage job (3.8): in the estate's routines or the analytics agent's watcher, as wave 0 decided; its own repo,
  its own tests (dedup marker, reopen on regression, 5 a day cap) against a fixture of growth answers and a fake `gh`.

**Wave 6 (operator decision). Native crash symbolication.**
- Sentry project in a PassionCode-owned org; DSN as a build-time define from the release environment;
  `crashReporter` `submitURL`, `uploadToServer` tied to the same consent switch; `scripts/release-mac.mjs` uploads
  symbols and creates the release, non-fatal; disclosure text names Sentry; test that the upload form fields are only
  the allowed `extra` keys.

## 6. Checks this design was built on (commands actually run, 2026-11-15)

- `grep -rnE "crashReporter|render-process-gone|uncaughtException|unhandledRejection|child-process-gone|unresponsive|onerror|unhandledrejection|startup-failure|ErrorBoundary" apps/desktop/src` (results in section 1.1).
- `growth.apps.list`; `growth.analytics.events.list` for `fabric` and `fabric-inbox`, production, 2026-10-16 to 2026-11-15.
- Daily digest count over `userData/digests/daily-2026-11.jsonl` (counts only, no line content read).
- `ls -la userData/logs` (segment dates); `test -f userData/observatory/ops-digest-binding.token` (absent).
- `sentry auth status`, `sentry org list --json`, `sentry project list sshlg/ --json` (read-only).
- `observatory_credentials fabric`.
- Skill read: `sheleg-dev` `error-tracking` 0.16.4 `SKILL.md`, `references/setup.md`; operator rule `global-24.md`.

Not verified: Sentry's current pricing; whether the renderer bundle is minified (affects frame names in fingerprints;
`electron.vite.config.ts` names no `minify` option, so electron-vite's default applies); the PassionCode site's form
route shape.
