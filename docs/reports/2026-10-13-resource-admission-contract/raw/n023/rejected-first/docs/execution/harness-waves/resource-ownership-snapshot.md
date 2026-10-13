# Read-only Git lease snapshot (N-023)

## Contract

`apps/desktop/src/main/gitLeaseSnapshot.ts` implements a local, read-only snapshot producer. Its fixed kernel configuration names an approved HTTPS remote, exact agent-sync lease key, expected run and repository label, freshness budget, deadline, and optionally the previously observed exact Git tip. No value is inferred from a task request or a writable repository's `remote.origin.url`.

An `observed` result proves only that the configured ref advertised the same SHA before fetching and after inspecting its exact commit bytes; the supported payload matched key/run/repository and was fresh and unexpired at the final clock reading. The opaque tip is not converted to a numeric fence. Every result has `executionAuthorized: false`. The remote URL is represented by SHA-256 in successful evidence; raw Git errors, host payload fields and remote URLs are not returned.

A renewal changes the tip. With `expectedTip` configured, that requires a new explicit observation rather than accepting an old proof. Two matching reads do not establish uninterrupted ownership between them or prevent a change immediately afterwards. Git push permission and a self-reported `run` are not cryptographic agent identity. This module acquires, renews and releases no lease; it cannot enforce writers or make a SQL/PTY action atomic with a remote Git lease.

## Supported format and transport

The encoding and payload follow installed agent-sync 1.22.1 `lease_name`, `_git_acquire`, `_refresh_lease` and `_lease_alive`: exact percent-encoded key; parentless commit over Git's empty tree; JSON `key`, `run`, `repo`, `ts`, `since`, `ttl`. The inspected installed script SHA-256 is `455d99c97894e4b5033399fac3fc5c638375dffae531982f22a8bd6899e56302`. This is a file pin, not a claim that the older local source repository has that release. No installed code or protocol is changed. Legacy lossy refs, keyless payloads, SHA-256 Git object repositories and lease TTLs over 24 hours are unsupported and refuse.

The default transport reuses `gitRun.ts` hardening in a newly created private bare scratch repository. It strips inherited Git/SSH/proxy overrides, system/global configuration, helpers, redirect following, prompts and non-HTTPS protocols. It reads the exact advertised SHA rather than a mutable fetched-ref alias; the commit bytes must hash to that SHA. The remote cannot choose a task checkout, hook, filter, lazy-fetch repository or shared fallback ref.

The default supports HTTPS without credentials. It does not borrow a person's credential helper or silently fall back to SSH. Private authenticated remote support needs a separately trusted transport/configuration; production credential composition is NOT_RUN. The injectable Git runner is trusted infrastructure and must preserve these transport constraints; the task must never select it.

## Bounds and uncertainty

One reader instance has one outstanding operation. A public timeout returns `unknown`; it does not cancel or forget an unresolved underlying promise. Further calls report `prior_io_unresolved` until that operation and scratch cleanup settle. Late results are discarded. Reuse the reader instance for its fixed binding; repeatedly constructing readers is not a global I/O limit.

Configuration caps the deadline at 30 seconds and age at 24 hours. Ref output is limited to 512 bytes, commit/other command output to 16 KiB, and key/run/repository sizes are bounded. Fetch asks for depth one, no tags and `tree:0` filtering. Servers may ignore filters: the default checks scratch size every 25 ms and after fetch, refusing more than 8 MiB or 1,024 entries and refusing symlinks. This is a sampled control, not a hard disk quota: transfer can overshoot between checks. It sends SIGKILL to the Git child on overflow and inherits `execFile`'s deadline/process semantics; it does not certify termination of arbitrary descendant processes. No native Git server or hostile descendant termination acceptance is claimed.

An absent, ambiguous, malformed, unreadable or expired lease is never free ownership. In particular, the installed acquire shortcut for a same-run expired lease is not used as evidence. Clock rollback, future timestamps and expiry during the read refuse. Output and cleanup failures return structured uncertainty without raw private error details.

## Acceptance and remaining composition

Run the production module's bounded tests:

```sh
node --experimental-strip-types --test apps/desktop/test/git-lease-snapshot.test.mjs
```

The suite uses actual refs and objects in an owned bare Git fixture, substituting only HTTPS transport with the fixture's local path. It covers expiry of the same owner's lease, foreign binding, exact-tip renewal, changes on either side of fetch, malformed payload/calendar, parent commits, altered object bytes, missing/ambiguous refs, clock change, timeout/repeated calls/late settlement, configuration mutation, and error redaction. Separate default-executor probes verify command/env hardening and fetch scratch overflow. These probes use an owned executable fixture, not a live private remote. No foreign ref is modified.

This closes a local snapshot-reading primitive only. The selected input/scope closure producer remains absent: a lease commit does not enumerate file paths, untracked files, symlinks, worktree bytes or task instruction dependencies. No request digest is echoed as independently verified input. A bounded manifest reader and source-owned run/session/input binding remain separate local implementation work. Full R1 ownership authorization additionally needs its documented authority semantics; this module does not manufacture its numeric fence or writer enforcement. Active resource DDL, machine policy, production composition and native acceptance are unchanged.
