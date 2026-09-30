<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# T3b — bounded native Codex view probe, 0.157.1

This test packet is independent of Fabric production binding. It follows the
[T3 source preflight and T3a policy](codex-tui-startup-01571.md). Parent source
integration owns the design map, capability status and release decision.

## Boundary and evidence

The [native runner](../codex-tui-native.test.mjs) creates separate disposable backend
and TUI profiles, an empty project, a rejecting local HTTP stub and an authenticated
WebSocket gateway. Only the empty fixture gets configuration files. No operator
profile, credentials, authentication/account mutation or external inference is used.

The [gateway](../helpers/codex-tui-native-probe-gateway.mjs) uses pinned `ws 8.22.0`
for real frame parsing and pinned `ajv 8.17.1` for generated schema validation. The
[test-only package lock](../fixtures/codex-tui-probe/package-lock.json) fixes dependency
bytes. Native schema bytes must match the [digest manifest](../fixtures/codex-tui-probe/schema-digests.json)
before a listener opens. These are test dependencies, not production packages.

- Frontend and backend capability tokens are distinct, in memory and per-child environment
  only; the backend argv carries only a SHA256 digest. The harness never prints or writes these raw tokens; disposable native profiles are removed after observed cleanup.
- TUI can connect only to the gateway port; backend outbound networking only to the owned
  rejecting stub port. Direct TUI-to-backend/stub denial is tested before TUI launch.
- Both native sandbox profiles forbid process creation. Real `fork` and `posix_spawn`
  negative checks run before the corresponding native process. A root-process exit is
  therefore not used to hide unobserved child writers. The PTY supervisor owns exactly
  its one child and attempts bounded cleanup on every post-fork parent path.
- Read-data access is limited to the fixture, named system runtimes/executable, selected
  device literals and the root directory itself. File metadata remains available; this
  is not a claim of zero filesystem metadata access. Operator-home data, arbitrary temp
  data and global Codex configuration are not in the allowlist.
- The root-directory literal is necessary for macOS executable startup: a harmless
  `/usr/bin/true` fixture aborted with SIGABRT without it and exited 0 with it. This
  permission lists the root directory; it does not grant recursive reads.
- The runner uses actual CommandLineTools Python, avoiding `/usr/bin/python3`'s xcrun
  shim, which attempted a forbidden subprocess/cache operation. Exact `/dev/tty` and
  `/dev/null` writes are necessary for the owned terminal; other TTY devices are not granted.
- Message/pending/byte/depth/time limits remain independent of progress. At most four raw
  connections, one authenticated view and one fresh thread are admitted. After the host
  observes the owned ready view it may arm one unsubscribe for exactly that thread; this
  is view detachment, never an execution Stop/quiescence proof. The fifth raw
  connection shuts down the gateway. `finished` means observed listener/socket closure,
  or an explicit `unknown` receipt after a bounded cleanup deadline.
- The only native menu selection is one fixed Down+Enter after both exact model-picker labels are observed (whitespace normalized after ANSI stripping). It keeps the existing model; no prompt text or arbitrary terminal input is available. The helper ignores repeated model choices.
- Provider bodies, unknown method strings and raw terminal output are never durable
  evidence. The receipt retains only authored protocol labels, booleans/enums, counts,
  the eventual owned thread ID and observed exit status. Authored diagnostic labels are
  not forwarding permissions.

- Plugins are explicitly disabled in both disposable configurations. A verified `config/read`
  reply must contain `features.plugins=false`. Optional plugin inventory remains unsupported:
  the gateway can return one fixed error before and one after thread binding, never a fake
  empty success or any catalog access. The accepted native run made no plugin request.
- Read-only overview bootstrap is fixed to two distinct `thread/list` variants once each,
  one loaded-thread list and, if requested, one exact owned metadata/empty-turn read. Lists
  hold at most one owned identity and no cursors; foreign or not-yet-bound identities fail
  closed. No pagination or history-message reading is enabled.

## Exact protocol findings

All source links below pin official commit
`36650394c5b38c2990ccf2a3457165ca3e9d9726` (tag `rust-v0.157.1`). The installed
binary must report exactly `codex-cli 0.157.1`.

| Behavior | Pinned source / verification |
|---|---|
| Empty account read never requests refresh | [GetAccountParams](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server-protocol/src/protocol/v2/account.rs#L544) defaults absent to false and omits false on serialization. Gate accepts exactly `{}` or `{refreshToken:false}`; true/null/extra fields fail. |
| Initial model, requirements and collaboration reads | [bootstrap_with_account](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L595); the actual gateway observes correlated replies. |
| Startup skills reload is a read of the owned cwd | [fetch_skills_list](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/background_requests.rs#L883) uses force_reload true. No skill/config writes are admitted. |
| Fresh remote startup reads effective config | [prepare_fresh_startup_config](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/startup.rs#L46) and [read_effective_config](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/config_update.rs#L180). Only `.` or exact fixture cwd, no layers, once; returned provider/sandbox/approval/web-search must match the fixture. |
| Current server notifications include emittedAtMs | [ServerNotificationEnvelope](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server-protocol/src/protocol/common.rs#L2048), [timestamped_server_notification](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server/src/outgoing_message.rs#L890). Generated notification schemas describe the payload, not this outer wrapper. Gate bounds the optional timestamp and never uses it as authority. |
| Backend emits remote-control status after initialize | Actual native receipt; only schema-valid `disabled` with null environment is accepted. Connected/connecting status, malformed envelope or extra properties close the gateway. No remote-control commands are admitted. |
| Explicit exit detaches the owned view | [handle_exit_mode](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/event_dispatch.rs#L3343), [shutdown_current_thread](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/thread_routing.rs#L46), [thread_unsubscribe](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L1503). Before-arm, wrong-thread, repeat and malformed-reply fixtures refuse delivery/receipt. |
| Model picker keeps the configured model | [native unit test](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/model_migration.rs#L570) proves Down+Enter selects `Rejected`, retaining the existing model. The gateway independently requires gpt-5.4 in the thread reply. |
| Remote task tools can be refused without enabling them | [native fallback](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L258) clears tools on a fixed unsupported error. The gate produces that error locally once for an otherwise exact request; only a fresh-ID tool-free retry with the same intent can reach the backend. |
| Startup overview performs parallel metadata reads | [agents_overview_threads.rs:229–321](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/agents_overview_threads.rs#L229) requests loaded IDs and two fixed recent-list variants; [345–373](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/agents_overview_threads.rs#L345) optionally reads owned metadata/one recent turn. The probe only accepts empty turns and the exact newly observed identity. |
| Plugin-disabled startup does not query the catalog | [background_requests.rs:559–566](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app/background_requests.rs#L559). An optional refusal path handles absent `forceRefetch` as false, as [plugin.rs:128–139](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server-protocol/src/protocol/v2/plugin.rs#L128) specifies. |
| Backend origin label need not be CLI | [app-server lib.rs:446](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/app-server/src/lib.rs#L446) supplies `SessionSource::VSCode`. Actual thread reply matched `vscode`; exact session UUID, parent/fork absence and owned scope are checked independently. |
| Fresh thread receives a disabled web-search override | [config_request_overrides_from_config](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/tui/src/app_server_session.rs#L1853); only the exact disabled override is admitted. |

The initial native attempts were deliberately refused on unreviewed notification wrapper,
account-read spelling and config/read. Each correction followed pinned source inspection
and negative transport fixtures, not blanket forwarding of the next request. Those earlier
attempts created no thread and reached no inference endpoint; the final receipt below is
separate from these partial observations.

## Reproduce

Install test-only dependencies, then supply schemas generated by the exact build. Schema
preparation is an offline code-generation command, separate from running a provider:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix apps/desktop/test/fixtures/codex-tui-probe
```

Generate into a fresh disposable directory with its own profile and no network:

```sh
python3 - <<'PY'
import json, pathlib, subprocess, tempfile
root = pathlib.Path(tempfile.mkdtemp(prefix='fabric-codex-schema-')).resolve()
profile = root / 'profile'
profile.mkdir(mode=0o700)
policy = root / 'offline.sb'
policy.write_text('(version 1)\n(allow default)\n(deny network*)\n(deny process-fork)\n'
                  '(deny file-write*)\n(allow file-write* (subpath ' + json.dumps(str(root)) + '))\n'
                  '(deny file-read* (subpath ' + json.dumps(str(pathlib.Path.home())) + '))\n')
subprocess.run(['/usr/bin/sandbox-exec', '-f', str(policy), '/opt/homebrew/bin/codex',
                'app-server', 'generate-json-schema', '--out', str(root / 'schemas'), '--experimental'],
               env={'PATH':'/usr/bin:/bin', 'CODEX_HOME':str(profile), 'TMPDIR':str(root)},
               check=True, timeout=10, capture_output=True)
print(root / 'schemas')
PY
```

Set `FABRIC_CODEX_TUI_SCHEMA_DIR` to that printed owned path for these commands:

```sh
node --test apps/desktop/test/codex-tui-native-probe-gateway.test.mjs
node apps/desktop/test/codex-tui-probe-pty.test.mjs
node apps/desktop/test/codex-tui-native.test.mjs
```

The native command is manual and macOS-specific; it is not in default CI. It must not be
replaced by an unrestricted invocation when a containment check fails. Dependency fetches
and pinned-source inspection happen outside the native sandbox; native external networking
remains denied. Remove the disposable schema preparation directory when finished.

## Final packet receipt and handoff

Measured on 2026-09-27, macOS, Node 26.8.2, exact Codex 0.157.1. The native
command exited **0** with the following bounded receipt:

```json
{
  "status": "PASS",
  "boundary": "native empty-thread view only",
  "build": "codex-cli 0.157.1",
  "threadId": "01a0e122-f3fd-7930-a2aa-0007307f16db",
  "readyView": true,
  "modelChoiceSent": true,
  "unsubscribeStatus": "unsubscribed",
  "nativeExit": {"kind": "exit", "code": 0},
  "backendSurvival": true,
  "threadStartRequests": 1,
  "inferenceAttempts": 0,
  "sandboxNegative": true,
  "noForkVerified": true,
  "outputBytes": 5988,
  "cleanup": "observed",
  "backendExit": {"code": 0, "signal": null},
  "ptyExit": {"code": 0, "signal": null},
  "gatewayCleanup": {"status": "closed"}
}
```

The actual method trace contained initialize/account/config/model/requirements/hooks/
collaboration reads, one locally rejected dynamic-tool declaration, exactly one forwarded
tool-free `thread/start`, loaded/list plus two recent list queries, two skills reads, the
owned `thread/started`, and one host-armed `thread/unsubscribe` request/reply with exact
`unsubscribed` status. The other legal statuses remain distinct and cannot pass this native receipt. No plugin
catalog, turn, model, shell, auth-write, or config-write method was forwarded. A separate
fresh authenticated observer then read the **same** owned thread from the still-running
backend with zero turns, before explicit backend cleanup. The empty thread happened to
survive unsubscribe in this build; this proves neither persistence across backend restart
nor cross-provider continuation.

Checks actually run:

- `node --test apps/desktop/test/codex-tui-native-probe-gateway.test.mjs` — **26 grouped
  real WebSocket fixtures PASS**, including malformed/binary/oversize traffic, auth401,
  deadlines/cleanup, exact thread scope, fixed startup roster, denied tools/plugins,
  pagination/foreign identities, duplicate requests, hostile compound method/ID values,
  and exact unsubscribe outcome preservation. These fixtures use a synthetic
  backend and do not independently prove native behavior.
- `node apps/desktop/test/codex-tui-probe-pty.test.mjs` — **3 owned Python PTY fixtures
  PASS**: cursor reply + normal exit, TERM cleanup, fixed one-shot model choice with
  duplicate-choice suppression. No provider in these fixtures.
- `node apps/desktop/test/codex-tui-native.test.mjs` — **native PASS** above, with
  actual containment negatives and cleanup receipts. This is manual, not default CI.
- Fresh disposable offline `app-server generate-json-schema --experimental` under
  no-network/no-fork sandbox — **30 schema fingerprints verified, zero mismatches**.
- `node --check apps/desktop/test/codex-tui-native.test.mjs`, Python helper compilation,
  and `git diff --check` — **PASS**.
- The preceding [T3a packet](codex-tui-startup-01571.md), source commit
  `24a062ada6fdfd3c7e1461b6aeac57b2cc25c6c8`, remains separate complete-message policy
  evidence. This packet adds transport framing and bounded native view evidence.

Several intermediate probes failed closed on unreviewed optional startup behavior or
strict metadata spelling before this accepted run. They are not reclassified as successes;
all measured attempts retained zero inference requests and observed owned cleanup. The
final successful run disabled plugins in the disposable fixture, preserved gpt-5.4, and
kept every mutating method denied except one fresh empty-thread metadata creation and its
exact view unsubscribe. The native rendered title/model check ignores case/ANSI spacing
and requires the input prompt plus an already verified thread-start reply.

**Handoff:** this member branch owns only the manual test, gateway/PTy helper, isolated
test dependency lock/schema fingerprints and this report. Root integration owns the
capability ledger, map, full-fast and workspace publication; none were changed here.
Independent review reran all 26 WebSocket groups and the three PTY fixtures; it found
and closed compound-method/ID coercion and ambiguous unsubscribe-outcome defects.
The reviewer did not rerun the native provider. The next task is root integration of this
bounded receipt, with the repository-wide source/documentation checks and publication. A subsequent production packet must own the process/auth transport,
connect the real Fabric UI, and verify restart/reconnect/Stop/Continue separately. No
execution Stop, writer quiescence, inference, model cancellation, real-account compatibility,
production binding, or complete provider readiness is claimed here.

---
**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded probe delivery and handoff.
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — pinned source, measured receipts and explicit limits.
