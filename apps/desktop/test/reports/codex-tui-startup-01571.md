# T3 — Codex 0.157.1 native TUI startup boundary

<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

Status: **preflight verified; native TUI attachment NOT_RUN**. The next packet is a
method-filtering loopback probe, not a product transport or a provider readiness promotion.
No production files, private profiles, credentials, live sessions or database were changed.

## Objective and result

The intended experiment connects native Codex TUI to our own authenticated loopback
backend, observes startup/read requests, exits the view, and verifies that the independently
owned backend survives. It must not start a model turn, use a real account, copy the operator's
profile, or enable external network access.

The [manual preflight](../codex-tui-startup-preflight.test.mjs) verifies the installed build,
actual CLI flags and the exact upstream files used for this review. It invokes only
`--version`, `--help`, and `agents --help`, inside an owned temporary profile and a macOS
sandbox denying all network, operator-home reads and writes outside that fixture.
The fixture is removed before the success receipt is printed.

The direct native attachment was not started. Our existing initialize probe does not observe
or filter requests originating in the TUI. A network sandbox allowing its backend connection
cannot distinguish `initialize` from `turn/start` on that same connection. Source review
alone must not be reported as a measured zero for native requests. The preflight therefore
prints `tuiObservedMethods`, `tuiTurnRequests` and `tuiModelInferenceRequests` as `null`,
with `tuiProbe: NOT_RUN`, and exits **2**, even when `preflight: PASS`.

This follows the task's explicit boundary: if a guarantee requires a gateway, stop the direct
probe and specify the smallest prerequisite. It is not a finding that this Codex build
necessarily starts an inference without input.

## Exact source and native-help evidence

On 2026-09-27, this read-only command resolved the annotated upstream tag:

```text
git ls-remote https://github.com/openai/codex.git refs/tags/rust-v0.157.1 'refs/tags/rust-v0.157.1^{}'
ac0e23e5232692b95268583c8278c50b8c436d2b  refs/tags/rust-v0.157.1
36650394c5b38c2990ccf2a3457165ca3e9d9726  refs/tags/rust-v0.157.1^{}
```

Six official source files were fetched at that peeled commit. The preflight checks their
SHA-256 values; it does not depend on a moving `main` branch. The installed binary reported
`codex-cli 0.157.1`; this version string and reviewed source pin do **not** constitute a
reproducible-build attestation for the binary.

| Fact | Pinned upstream evidence | Consequence |
| --- | --- | --- |
| Remote TUI uses a separate authenticated app-server connection. | [tui/lib.rs:490](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/lib.rs#L490) | Native client startup can be probed independently of inference, but the transport itself is not read-only. |
| Startup reads the account without requesting token refresh. | [app_server_session.rs:724](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L724) | A permitted read must require `refreshToken:false`; login/refresh operations remain forbidden. |
| Login/onboarding depends on the account and provider auth requirement. | [tui/lib.rs:1261](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/lib.rs#L1261), [tui/lib.rs:2293](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/lib.rs#L2293) | A fresh unauthenticated profile does not prove that a working thread/overview screen will be reachable. Do not bypass this with real or fabricated credentials. |
| Later bootstrap requests model metadata, configuration requirements and collaboration modes. | [app_server_session.rs:590](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L590) | These are separate methods to review; model catalog reads are not inference receipts. The first gate must not auto-allow every method ending in `read` or `list`. |
| Once normal startup reaches the app, StartFresh schedules a thread start regardless of whether an initial prompt was supplied. | [app/startup.rs:389](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/startup.rs#L389), [app/startup.rs:16](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/startup.rs#L16), [app_server_session.rs:1671](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L1671) | “No prompt argument” is not an initialize-only contract. Thread creation alone is not proof of a model turn. |
| `codex agents` rejects an initial prompt/images and selects AgentsOverview; that startup branch skips the new-thread call. | [cli/main.rs:1077](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/cli/src/main.rs#L1077), [tui/lib.rs:1438](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/lib.rs#L1438), [app/startup.rs:398](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/startup.rs#L398) | Prefer this narrower entry for the next probe. It still shares the earlier auth/bootstrap path; it is not a hard read-only client capability. |
| TUI remote shutdown closes its WebSocket worker. | [remote.rs:347](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server-client/src/remote.rs#L347), [remote.rs:644](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server-client/src/remote.rs#L644) | View disconnect is distinct from backend process termination. Actual native exit/continued backend liveness still needs measurement. |
| Dynamic MCP task-tool startup shown in this startup code is guarded for LocalDaemon. | [app/startup.rs:325](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/startup.rs#L325) | Do not claim that this particular startup side effect necessarily runs for explicit `--remote`. |

Actual preflight command:

```sh
node apps/desktop/test/codex-tui-startup-preflight.test.mjs
```

Observed result: `preflight: PASS`, `status: NOT_RUN`, `tuiProbe: NOT_RUN`, exit 2.
The receipt identified all six source files, both root and `agents` remote flags,
`agents --no-alt-screen`, and `ownedFixtureRemoved:true`. Only three help/version CLI
invocations ran; no TUI process or backend was started by this packet.

Trimmed native-help stdout digests from that receipt:

- Root help: `c077e724b5b49a832d8bc8b409424ec232f2ee66b90ca978df8759acf4235fed`.
- Agents help: `30a14aba16f01fd5bcbad3073565e160544a6f9dd6daedc102c88ef6c173d3ba`.

The earlier, independently rerun [T2 probe at c8e927e](https://github.com/passioncode-ai/fabric/blob/c8e927ebbfb609773e38c741dc40a498e0fe924d/apps/desktop/test/codex-loopback-native.test.mjs)
proved two hand-written clients' initialize routing, HTTP 401 for missing/wrong tokens,
and owned backend exit. Those facts are not native TUI attach/exit evidence.
The [topology proposal at 42bf7ba](https://github.com/passioncode-ai/fabric/blob/42bf7ba/docs/launch/harness-r0/provider-topology-proposal.md)
remains a proposal, not a capability promoted by this preflight.

## Smallest next packet: T3a guarded startup and view disconnect

Scope: a manual test-only forwarding gate and its offline negative fixtures, followed by
one bounded native `codex agents` invocation. No production transport, credentials,
provider topology promotion, thread execution, or modification of installed Codex.

1. **Prove the gate before starting Codex.** Two independent capability tokens: TUI→gate
   and gate→backend. The TUI receives only the first through its dedicated environment
   variable; neither goes in argv, URLs, durable files, raw logs or failure text. Bind both
   listeners explicitly to owned loopback ports. Backend and TUI use separate empty profiles.
2. **Enforce the boundary at forwarding.** Accept only one bounded `initialize` request,
   the exact `initialized` notification, and typed `account/read` with `refreshToken:false`
   in the allowed sequence. Deny unknown methods and malformed envelopes before any upstream
   write. Keep the gate denied after a violation. Do not blanket-pass responses to server
   requests: unsolicited approval/tool/elicitation requests must stop the probe without assent.
3. **Do not expand automatically.** In the first phase, reject `thread/start`, `thread/resume`,
   `thread/fork`, every `turn/*`, realtime, command execution, config writes and auth mutations.
   Further bootstrap reads such as `model/list`, `configRequirements/read` or overview lists
   require their own reviewed schemas and a later explicit whitelist change. If TUI needs one,
   report the stopping method, not a native readiness success.
4. **Keep limits independent of progress.** Bound frame/message size, pending IDs, connections,
   bytes and the whole probe deadline. Handle fragmentation, non-text frames and invalid UTF-8
   correctly; do not write a partial WebSocket parser as a safety boundary. A pinned reviewed
   library or an existing proven implementation is a prerequisite. Redaction is not a substitute
   for discarding payloads: persist only directions, method names, opaque IDs, counts and outcomes.
5. **No bypass path.** TUI sandbox may connect only to the gate's exact loopback port; it must
   not reach the backend directly or use an implicit local daemon/Unix socket. Backend outbound
   networking remains denied. Both profiles/cwd are owned empty directories, with operator-home
   and keychain access denied and all outside writes denied. Never weaken the sandbox to pass.
6. **Native observation.** Launch `codex agents --remote ws://127.0.0.1:<gate-port>
   --remote-auth-token-env <dedicated-variable> --no-alt-screen` with no prompt, image or copied
   configuration. Keep a bounded owned PTY solely for the view. A login screen with null account
   may be the last reachable UI; record it as such. No login, fake auth response or external provider
   configuration should be added merely to reach another screen.
7. **Independent exit.** Attempt only the reviewed native cancel/exit gesture, then observe
   the exact TUI process exit. A surviving PID alone is insufficient backend liveness: open a new
   owned observer connection and require a fresh initialize reply. Close that observer, then
   signal and observe the exact owned backend. Keep all fixtures if process cleanup is uncertain;
   never kill an operator process or reuse a PID without its owned-process evidence.
8. **Separate verdicts.** Report startup methods actually received/forwarded, denied methods,
   the exact last native UI phase, TUI exit, backend post-exit reply, and backend cleanup separately.
   A forbidden method forwarded, any unexpected model/auth attempt, an unbounded connection,
   or unknown cleanup fails acceptance. A rejected later startup read means bounded partial
   observation, not full TUI/workspace readiness. A blocked upstream call is not an absent attempt.

Offline gate acceptance must include: `turn/start` before/after initialize; malformed or
batched JSON; fragmented/oversized messages; unexpected server requests; duplicate/foreign
IDs; delayed reply after deadline; wrong/missing tokens; teardown before authorization;
and direct-backend bypass refusal. Every forbidden case must assert **zero upstream writes**,
not just a displayed error. Native acceptance comes only after these guards pass.

## Reproduce the source/help prerequisite from a fresh checkout

The test never downloads source or enables network. Fetch the reviewed source separately:

```sh
python3 - <<'PY'
from pathlib import Path
from urllib.request import urlopen
commit = '36650394c5b38c2990ccf2a3457165ca3e9d9726'
source_dir = Path('/tmp/fabric-codex-tui-preflight-01571-source')
files = ['codex-rs/cli/src/main.rs', 'codex-rs/tui/src/lib.rs',
         'codex-rs/tui/src/cli.rs', 'codex-rs/tui/src/app/startup.rs',
         'codex-rs/tui/src/app_server_session.rs',
         'codex-rs/app-server-client/src/remote.rs']
for name in files:
    target = source_dir / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(f'https://raw.githubusercontent.com/openai/codex/{commit}/{name}', timeout=20) as response:
        target.write_bytes(response.read())
(source_dir / 'commit').write_text(commit + '\n')
PY
node --check apps/desktop/test/codex-tui-startup-preflight.test.mjs
node apps/desktop/test/codex-tui-startup-preflight.test.mjs
```

Expected native test status remains `NOT_RUN` / exit 2. A missing source snapshot gives
`preflight: NOT_RUN`; mismatched reviewed bytes give `preflight: FAIL` before invoking Codex.
`FABRIC_CODEX_TUI_SOURCE_DIR` may select another source snapshot location;
`FABRIC_CODEX_BIN` may select the installed binary, still subject to the exact version and
sandbox checks. No native TUI, model, account or external-network acceptance is implied.

## Handoff

Completed: exact tag/source review, offline hash gate, sandboxed native help checks, and T3a
complete-message policy fixtures. Native TUI startup/exit remains NOT_RUN. The next packet
is T3b below, with a concrete transport boundary before any native TUI launch.
No shared capability flag, UI status, design map, production configuration or deployment
was changed by this packet. Parent iteration owns review, integration and documentation propagation.

Used: `task-pipeline` for the bounded packet and handoff; `evidence-docs` for pinned claims,
actual receipts and explicit NOT_RUN limits.

## T3a receipt — complete-message policy only

The test-only [gate](../helpers/codex-tui-read-probe-gate.mjs) accepts the exact pinned
initialize → initialized → single account/read(refreshToken:false) sequence. Every other
client method and every unsolicited server message closes the gate before forwarding.
It bounds input bytes/count/depth, validates UTF-8 and correlation, rejects duplicate JSON
keys, and retains a sticky deadline and immutable connection epoch. Snapshots contain only
authored method labels and counters; no raw provider body or unknown method is retained.

Actual command: `node apps/desktop/test/codex-tui-read-probe-gate.test.mjs` — **14 groups PASS**.
An independent read-only review reran these fixtures with no concrete findings. This proves
complete-message policy with trusted synchronous ports that honor the supplied final-write
fence. It does **not** prove WebSocket framing, authentication, actual socket ownership,
process containment or native TUI behavior. Those remain NOT_RUN. The helper rejects async
ports; a return value cannot undo a port that has already violated its documented contract.

## T3b next packet — approved bounded native path

The parent explicitly approved this next scope after T3a review; it is not an expansion of
T3a's current allowlist. Keep it in a separate test-only commit:

- One exact 0.157.1 backend, fresh owned profile/config/cwd and a local stub Responses provider
  with `requires_openai_auth=false`; a separate empty TUI profile. No private account/config
  copied. Only fixture files and one fresh `thread/start` metadata record may be created.
- A real authenticated WebSocket gate, using a pinned standard parser, with distinct frontend
  and backend tokens. TUI outbound only to that gate's exact port; backend outbound only to
  the owned stub's exact port; operator-home reads, keychain, external writes/network denied.
- Whitelist only the bootstrap metadata reads confirmed in pinned source/schema, plus exactly
  one fresh thread/start. No turn/start, turn/steer, auth/config writes, arbitrary command,
  resume or fork. Deny every unreviewed method before upstream write. The stub rejects and
  counts every inference attempt; any attempted inference fails the native acceptance.
- Record the actual thread/start response identity. After a native ready view, use the reviewed
  exit gesture, observe the TUI exit separately, then a new observer initialize and exact
  thread/read must prove the same backend and thread survive. Clean up only owned processes.

This requires a new explicit account-response policy because T3a currently requires
`requiresOpenaiAuth:true`, whereas the local stub needs false. It also requires transport-level
fragmentation, binary/malformed/oversized input, wrong/missing token, late epoch and bypass
negative checks before native launch. A fixture backend test is not native evidence. If any
step is blocked, report the precise last reachable phase and NOT_RUN/partial status rather
than promoting provider readiness. No production binding or release follows from this probe.

## Follow-on native view packet

[T3b bounded native receipt](codex-tui-native-01571.md) adds real authenticated framing and
owned native empty-thread view/exit/backend survival evidence. Its limits remain separate
from the source preflight and T3a synthetic policy checks above.
