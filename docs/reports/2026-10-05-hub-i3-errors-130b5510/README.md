---
report:
  id: fabric/2026-10-05-hub-i3-errors-130b5510
  title: "Fabric 0.3.1 · iteration 3 · errors review at 130b5510"
  kind: review
  project: fabric
  domains: [architecture, reliability]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-10-19
  summary: >-
    Independent iteration-3 errors review of the converged 0.3.1 candidate 130b5510: verdict request-changes,
    9 findings, 2 blocking. Dispositions live in the hub verification ledger.
  sources:
    - name: "Candidate source"
      url: "https://github.com/passioncode-ai/fabric/tree/130b5510011a0f15858642838fc906ad4af4bf67"
      read_at: 2026-10-05
  produced_by:
    agent: "independent reviewer subagent (fresh context), saved by the coordinator"
    task: "p08-i3-review-130b5510"
  supersedes: []
  consumers: [fabric]
---

# Fabric 0.3.1 · iteration 3 · errors review at 130b5510

Candidate: `130b5510011a0f15858642838fc906ad4af4bf67`. This was an independent reviewer run: a fresh context, and the earlier reviews were compared only after the findings were formed. The coordinator saved this report verbatim from the reviewer's final message, because the reviewer's harness refused `.md` writes. The structured findings are in `findings.json`. The probes and their outputs are in `probes/`.

## Method

- Scope came from `git diff --stat v0.3.0 130b5510 -- apps supabase packages`: 131 files.
- I read the hub code line by line: the `agentSurface.ts` diff, `hub.ts`, `hubTools.ts`, `hubCall.ts`, `productForwarder.ts`, `productConnect.ts`, `observatoryVault.ts`, `accessService.ts`, `accessStore.ts`, `consentPresenter.ts`, `agentRegistry.ts` and `executorAuth.ts`.
- I also read the two stop-controller diffs, the `index.ts` hub wiring, `shared/access.ts`, migration 80, `quit.ts`, and the request and close paths of MCP SDK 1.30.0.
- I ran focused tests one file at a time under `nice`, then wrote throwaway probes against the candidate's sources.

## Commands run

All were run from `apps/desktop` and exited 0.

| Test | Result |
|---|---|
| `node --experimental-strip-types --test-force-exit test/hub-call.test.mjs` | 16/16 |
| `hub-call-i3` | 22/22 |
| `hub-access-service` | 8/8 |
| `hub-access-refusals`, `hub-files`, `consent-presenter`, `executor-auth`, `claude-provider-control`, `codex-provider-control` | pass |
| `hub-surface` | 11/11 |
| `hub-products` | 51/51 |
| `agent-registry` | 12/12 |
| `contract-consumer` | 9/9 |
| `npx vitest run src/shared/access.test.ts` | 28/28 |

## Findings

| id | Blocking | Finding, evidence and fix |
|---|---|---|
| **E-1** | **yes** (hangs the main process) | **What happens:** a FIFO planted at `hub.json` hangs Fabric's quit for good, and any process running as this user can plant it.<br>**Evidence:** `hub.ts:117`: `withdrawHub` reads the file with a plain `readFileSync`. `index.ts:597-599`: that read runs as a quit stop. `quit.ts:95-101`: all stops run before the 10 s deadline and the 15 s outside reaper are armed, so nothing guards the read while it blocks. Probe `p1`: a regular file is withdrawn in 1 ms; with a FIFO it was still blocked at 5000 ms and had to be SIGKILLed. Probe `p2` printed the order: stop, then `deadline armed`, then `reaper armed`.<br>**Fix:** read `hub.json` the way `readRegularFile` reads registry files (`lstat`, `O_NONBLOCK` open, `fstat().isFile()`, bounded read), or compare a `stat` instead of reading it. Arm the deadline and the reaper before running any stop. Add a FIFO-plant test. |
| **E-2** | **yes** (judgement, see the note below) | **What happens:** every external request whose caller hangs up keeps its admission slot for ever.<br>**Evidence:** `agentSurface.ts:706-794` releases `externalPending` only in the `finally` after `await transport.handleRequest` (line 787). In JSON-response mode, the SDK settles that promise only through `resolveJson` (`webStandardStreamableHttp.js:578-595`). `close()` (`webStandardStreamableHttp.js:771-787`), which `res 'close'` calls, never calls it, so the `finally` never runs. Probe `p8`: after 32 hung-up `agent.call`s the slots were `{thisCredential:32, total:32}`, and the next valid request got `429 too many concurrent requests`. Control `p8-control`: a call the agent waits for releases its slot (0/0).<br>**Impact:** 32 hang-ups lock out a binding until restart. 32 on the shared door token stop every agent from asking for access. 128 in total close the whole hub. The tool's own text advertises cancelling, so ordinary use triggers this.<br>**Fix:** release exactly once, on `res` close or finish, or in the `finally` (a guarded `release()`). Test: N+1 hang-ups, then a valid call answers 200. |
| E-3 | no (medium) | **What happens:** a failed read of live bindings at start is only a budget hint, but it also takes down the session surface.<br>**Evidence:** `agentSurface.ts:343`: `start()` awaits `primeCredentialVerifiers()` before it listens. The fallback in `hub.ts:173-179` fails the same way. Probe `p7`: the session endpoint is `""`.<br>**Impact:** sessions lose their surface, which they did not in 0.3.0.<br>**Fix:** catch the failure, log it and keep listening. |
| E-4 | no (low–medium) | **What happens:** a repeated stop after a scope change answers `refused`, although the first write may have run.<br>**Evidence:** `claudeProviderControl.ts:194` checks scope before the cached answer at `:198`, and `codexProviderControl.ts:168` does the same before `:172`. Probe `p6`: the first call returned `outcome_unknown` after 1 write; the repeat answered `refused scope_changed`.<br>**Fix:** return the cached or pending answer first, or map that case to `outcome_unknown`. |
| E-5 | no (low) | **What happens:** a poller that hung up still consumes the one-time binding credential.<br>**Evidence:** `hubTools.ts:136-143` does not pass the request's signal. `accessService.ts:268-275` mints and records the credential unconditionally. Later polls say it was "handed over once" (`:263`).<br>**Fix:** check `signal.aborted` before minting, and reword the note. |
| E-6 | no (low) | **What happens:** a POST carrying no state ends the operator's pending connect attempt.<br>**Evidence:** `productConnect.ts:306-320`. Probe `p3`: a `text/plain` POST got 415 and the attempt became `failed/invalid-delivery`. The genuine delivery then got `400 unknown state`, so the product revokes the key. The earlier V2 ER-9 test intended this behaviour.<br>**Fix:** settle an attempt only from a delivery that carries its valid state. |
| E-7 | no (low) | **What happens:** a keyless `agent.call` has no duplicate guard, and its outcome-unknown text names "this idempotencyKey" although none was sent. Answered keys are sent again after 24 h, as documented.<br>**Evidence:** `hubCall.ts:451`, `:185-191`, `:71` and `:459-461`. Probe `p5`: a key retried after 24 h was sent again (2 sends); a keyless repeat was sent again (4 sends).<br>**Fix:** require a key for mail-sending capabilities, and word the keyless case separately. |
| E-8 | no (low) | **What happens:** every `fabric.access.request` re-reads the whole registry synchronously, with no cap on the number of files.<br>**Evidence:** `accessService.ts:158`; `agentRegistry.ts:283` and `:249-268`. Probe `p4`, per refresh on the main thread: 20 files 0.6 ms; 1000 files 29.7 ms; 1000 × 60 KiB files 57 ms. The door admits up to 600 requests/min.<br>**Fix:** cap the entry count, and debounce or mtime-gate the refresh. |
| E-9 | no (low, not measured) | **What happens:** hub database calls have no deadline, and every access write, including the operator's revocations, shares one serial chain.<br>**Evidence (code only):** `index.ts:477-479` creates the database client with no timeout, so undici's ~300 s defaults apply. `accessService.ts:119-123` runs request, status, decide and revoke one at a time.<br>**Fix:** a per-call `AbortSignal.timeout` in `accessStore`. |

**Note on E-2.** The brief's blocking list (duplicate effect, disclosure, main-process hang, forged authority, data loss) does not literally name a permanent lockout of the hub. I marked it blocking because the main process keeps those request handlers pending for ever. Held strictly to the list, it is a high-severity non-blocker; E-1 alone still makes the verdict request-changes.

## Checked and holding

- **Loopback only:** the hub listens on 127.0.0.1 and `[::1]` with `ipv6Only`. A `Host` that does not name the listener gets 421, and any `Origin` gets 403.
- **Product secret:** it goes into the vault on stdin and comes back through a 0600 FIFO, read non-blocking. It travels only in headers, redirects are refused, and echoes are scrubbed.
- **Binding credential and door token:** both are kept as sha256 and compared in constant time.
- **Authority before the forward:** grants and the connection are read again after the vault read, and the retired-binding and signal checks run right before the forward.
- **Unknown outcomes:** `reached` decides `outcome-unknown`, and those keys are never sent again.
- **Response and output bounds:** 8 MiB per product response; decoded output is limited to depth 64, 100 000 nodes and 4 MiB.
- **Request bounds:** a 1 MB body with a 10 s read deadline, no JSON-RPC batches, and input depth capped at 16.
- **Executor auth:** child processes are killed as a group, and output is capped at 32 KiB.

## NOT_RUN

- `scripts/ci.sh`, as instructed.
- The tests that need the local database: `hub-access-db`, `hub-door-db`, `hub-upgrade-db`, `hub-authority-boundaries-db` and `restore-authority-db`. Migrations 76, 77 and 80 were not applied to a live stack.
- A real Fabric Inbox forward or connect, and a real Observatory vault.
- The packaged Electron app: the consent dialog, and a real quit with the E-1 plant.
- The renderer test suites (UI, outside this level).
- A stalled-database probe for E-9.

## Compared afterwards with the earlier reviews

- E-2 is a regression introduced by the admission accounting added for the earlier I3-E4 finding. Its tests cover a partial body and an aborted body, but not a hang-up after the body was read.
- E-1 is new. The earlier ER-1 checks covered FIFOs in the registry and symlinks planted at `hub.json`, not a FIFO read by `withdrawHub` at quit.

## Verdict

**Request changes.** 2 blocking, 7 non-blocking.
