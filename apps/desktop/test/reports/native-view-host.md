<sub>ssheleg skills — task-pipeline · agent-orchestrator · evidence-docs</sub>

# T1 host — concrete native view PTY registry

Scope: new [nativeViewHost.ts](../../src/main/nativeViewHost.ts),
[actual PTY tests](../native-view-host.test.mjs), and this handoff. Base source is
`5c498acb815a9e25a5a430487f48ebe5d915e176`. The existing
[nativeViewLifecycle coordinator](../../src/main/nativeViewLifecycle.ts) is composed
by this host; its earlier [contract](native-view-lifecycle.md) remains applicable.
No index, execution PtyManager, SQL, UI, descriptor, provider profile, global config,
real provider backend, credential or model was changed or invoked.

## Brief and implementation contract

The missing piece was a physical host, rather than another simulated lifecycle.
The factory now starts actual POSIX node-pty processes, retains their exact local
handles, writes to their owned PTY descriptors, and observes the captured local
process group. It still requires a **previously established backend owner** from
trusted bootstrap; neither the recipe nor a view proves that such a backend exists.

Input is a main-only `NativeViewHostOptions`:

- Full Fabric Estate/project/task/Run/ordinal/session, membership revision, and
  backend host/boot/process/connection identity from the existing owner record.
- Fresh synchronous `currentOwner` getter. The coordinator compares all identity
  fields before effects and retains a sticky veto after loss or ambiguous input.
- One host-allowlisted recipe: absolute executable plus expected SHA-256, fixed
  arguments, cwd, explicit environment and bounded terminal dimensions. These are
  copied and frozen. The executable hash is checked again before every spawn.
  Bootstrap must select an approved **view-only** recipe: hashing a random program
  does not prove it is semantically a view or establish a sandbox.
- Optional synchronous output/observation callbacks. Returned promises are absorbed
  and fence the owner; an asynchronous consumer cannot silently become an authority
  source. Raw output is delivered transiently, never retained in snapshots or logged.

The returned action facade exposes attach, reconnect, detach, input, owner loss,
retirement and read-only state. Actual `viewExited` and output cursor advancement
remain private to the host, as do all physical handles. There is no raw PID signal
API, arbitrary command selection, execution journal or provider Stop port.

The optional second factory argument is a **privileged system test seam**, not an
IPC interface. Production bootstrap uses the default node-pty/fs/process observer.
A caller replacing those system operations is trusted code and must obey their
synchronous effect contracts; arbitrary replacements are not sandboxed.

## Why this uses a pinned private fd adapter

The installed/locked dependency is node-pty **1.1.0**; see
[pnpm-lock.yaml](../../../../pnpm-lock.yaml). Source inspection on 2026-09-27:

| Installed source | Observed behavior | SHA-256 of inspected file |
|---|---|---|
| `node-pty/lib/unixTerminal.js` (`_write`, `CustomWriteStream`) | Public write queues asynchronous `fs.write` calls and retry on EAGAIN, without an application effect fence. | `a62e3a60c3bc1b0e7261f58284856df748dcee6761a2bc7a5a5ba98b22660473` |
| Same file (`kill`, `destroy`) | Public kill signals a bare PID; destroy arranges a later SIGHUP. | Same digest |
| `node-pty/src/unix/pty.cc` (`pty_nonblock`, parent spawn path) | Master fd is configured nonblocking; fork may precede an fd-setup exception. | `5e1005d6bdcfbe97b486ee415419fe7adae99035047f07340fbad36419e0bae6` |

Those files are dependency receipts, not vendored copies. Regenerate from the locked
package before changing this adapter. Runtime accepts only version 1.1.0 on macOS; Linux needs its own measured fd
identity adapter and is refused here.
Missing fd ABI refuses input and retains/compensates the captured local process.

The host never calls node-pty `write`, `kill` or `destroy`. Input uses one bounded
`writeSync` against the captured fd after the caller fence, exact registry-handle
and descriptor-identity checks. After potentially reentrant checks it repeats the
authority/deadline fence, then compares a separate physical stamp using closed-over
builtin fstat plus private registry flags immediately before the syscall. Descriptor
closure disables future input. A partial
write, EAGAIN or thrown error is **unknown**, fences the entire owner, and is never
queued/retried. Kernel acceptance of bytes is not provider acceptance of a task.

## Exit, local cleanup and honest uncertainty

[processBoundary.ts](../../src/main/processBoundary.ts) captures the separately owned
view process group. Close/dispose requests TERM only for that captured group, with
a final ticket/deadline fence before signaling; no automatic SIGKILL is performed.
The backend is never looked up by a view PID or selected for termination.

The following are separate observations:

1. The native root exit callback, with exit code/signal if available.
2. A fresh captured-group observation. If exit arrives during the asynchronous
   process snapshot, the sample is repeated with the observed exit flag.
3. Group-empty after observed root exit, which settles this local view attachment.

A root exit with a live or unknown group does **not** produce a closed-view receipt;
it fences the owner and stays unresolved. The snapshot always reports
`allDescendants: unknown`: a POSIX group sample cannot prove that no descendant
escaped before it was observed. The existing observer's identity/start/group and
continuity checks are reused; they are not an atomic OS pidfd guarantee.

Callbacks are installed before asynchronous capture. A setup failure retains the
spawned handle and attempts capture, so exact local compensation remains possible.
If native spawn throws without returning a handle, fork may already have happened:
the owner is fenced, no "no process" claim is made, no PID is guessed, and external
reconciliation is required. That native API limitation is intentionally explicit.

No observation above ends a Fabric Run, releases a lease, revokes an execution
credential, appends `terminal.closed`, or supplies provider quiescence evidence.

## Measured checks

```sh
cd apps/desktop
node --experimental-strip-types test/native-view-host.test.mjs
node --experimental-strip-types test/native-view-lifecycle.test.mjs
./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck \
  --types node src/main/nativeViewHost.ts
```

- **14 concrete host groups PASS**, using actual node-pty 1.1.0 and disposable local
  Python fixture processes on macOS. Includes real input/output, natural exit, TERM closure,
  reconnect, foreign/stale tickets, owner loss during capture, actual partial write,
  EAGAIN injection, descriptor-change injection, immutable recipe/hash checks,
  missing-fd compensation, a spawned-but-thrown launch fault, and reentrant/slow fd checks that must not reach the write syscall.
- **19 existing coordinator groups PASS** and strict standalone TypeScript PASS.
- Independent review reran the final 14 native groups, 19 coordinator groups and
  strict TypeScript check, verified both dependency source hashes, and accepted the
  final write fence and macOS-only ABI boundary. Staged diffcheck and relative report
  links passed.
- A TERM-ignoring descendant fixture proves root exit is not group closure. Test-only
  final cleanup explicitly escalates **captured owned test groups** and observes them
  empty. Every run retained the fixture if cleanup could not be proved; successful
  runs removed all owned temporary files. No unrelated process was signaled.
- Native provider/model/network/auth/real DB, Linux native execution, Windows, Electron runtime integration,
  product UI and full repository fast checks are **NOT_RUN** in this packet.

## Handoff / exact next task

Root owns shared ADR/map/status, integration, full-fast and workspace publication.
After independent review, integrate this three-file packet. The next host composition
must obtain a genuine backend registry entry and construct a provider-specific approved
view recipe from trusted bootstrap; renderer input must not supply the executable,
arguments, environment, owner record or system ports. Connect sticky owner loss to
launch/continuation admission at existing actual effect edges.

Wire view callbacks separately from the existing execution PtyManager's exit callback,
which performs credential revocation and canonical Stop. Keep current SQL/provider Stop
proof requirements unchanged. Then test **the actual composed backend/view topology**
and restart/restore/closure behavior before activating a descriptor or exposing a UI.
This packet is a concrete reusable native host, not runtime capability promotion.

---
**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded concrete host packet and handoff
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — exact owner and local view lifecycle
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — measured native PTY checks and source receipts
