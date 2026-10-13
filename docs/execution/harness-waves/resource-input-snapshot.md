# Selected input snapshot primitive

## Contract

N026 implements a cooperative, bounded snapshot of **explicitly selected** local
inputs and mutable paths. It does not discover a complete dependency closure,
authorize a task, prove continuous file ownership or wire the launcher. Every
result has `executionAuthorized: false`; successful receipts also have
`selectionComplete: false`.

The source is `apps/desktop/src/main/resourceInputSnapshot.ts`. The source-owned
[next packet](input-scope-next-packet.md) defines the composition prerequisites.
This module uses that packet's selected-file boundary, not an R1 `held` callback.

`createResourceInputSnapshotReader(assignment, deps)` copies/freezes a trusted
fixed assignment: Estate/project/task/session/attempt identity, selection revision,
canonical approved repository root, configured remote digest and expected Git
HEAD, exact selected input paths, exact mutable scope and mandatory budgets.
Mutable paths explicitly require either a regular file or absence. Untracked
selected input is refused unless that exact input has `allowUntracked: true`;
ignored paths are always refused. No globs or directory expansion are supported.
The trusted selector must exclude credentials, generated MCP bearer files and
other private material. Refusing `.git` components is a concrete control, not proof
that filename heuristics can establish secret-free selection.

`capture()` returns `observed`, `refused` or `unknown`. `current(previous)` performs
a new capture and compares input/scope evidence; it accepts only immutable receipts
minted by this instance, tracked weakly rather than in an unbounded registry.
Copying a receipt or presenting another reader's receipt returns `foreign_receipt`.
A prior receipt is evidence of an earlier observation, not a reusable permission.

## Actual reads and identities

The real default runs hardened Git metadata commands without a shell, checkout,
reset, clean or fetch. It verifies the exact worktree top-level and expected HEAD.
The before/after bounded logical index view includes `ls-files --stage -v -z` plus
`ls-files --debug -z`: stage, object, flags and stat-cache projection are included.
This is a Git-produced logical view, not a claim to hash every physical index
extension or make multiple Git commands atomic. Unmerged/unsupported selected
entries and gitlinks/submodule paths refuse. Replacement-character metadata is
conservatively refused because the decoded string cannot prove original invalid
UTF-8 bytes; this also refuses a genuine replacement-character filename.

Every selected path is canonical and repository-relative. Absolute paths, dot or
parent components, empty components, control characters, backslashes, `.git`
components, duplicate selections and actual inode aliases refuse. Root and all
existing parent components are checked with `lstat`; symbolic links, directory
substitution, nonregular selected files and root escape refuse. A missing parent
of an explicitly absent mutable path is rechecked too. The approved root must
match `realpath` and Git's actual top-level; selecting a nested directory as if it
were an independent repository is unsupported.

Regular files are opened read-only with no-follow and nonblocking flags. Opened
file identity/stat must match pre-open metadata. Reads hash raw bytes, never a
Git filter/diff view or decoded character count. Each allocation is at most64KiB,
and each read is capped to remaining file/total budget plus one overflow byte.
Growth after the pre-stat cannot cause an unbounded allocation. Opened-file stats,
path stats and the final selected-file stamps are compared; root and parent inode
identities, explicit absences, HEAD and index are rechecked before receipt.

An independently invoked trusted `identity()` provider must match the fixed
Estate/project/task/session/attempt both before and after reading. This module
ships no authoritative implementation of that provider; task input must never
choose it. Configured `approvedRemoteDigest` is provenance supplied by trusted
configuration, not proof derived from a repository's writable origin setting.
No remote URL, raw file bytes or selected paths are returned in receipts/errors.

Domain-versioned SHA-256 input/scope digests bind identity, fixed selection and
mapping revision, configured repository provenance, expected/observed HEAD,
logical index view and sorted file records containing raw-byte digest, size and
mode or explicit absence. Ordering uses deterministic UTF-16 lexical comparison.
Changing an unrelated untracked file does not expand the selected set. An index
change anywhere can conservatively invalidate the selected snapshot.

## Optional lease evidence

No configured lease yields `lease.state: not_requested`. Configuring one requires
an independently invoked trusted reader before and after filesystem work. The
N023-shaped result must match remote digest, key, actual run label, repository
label and exact tip, and have fresh timestamps and an unexpired lifetime. Missing
or unusable evidence yields `unavailable` with refusal/uncertainty; it never becomes
held ownership. The configured key-to-scope mapping revision enters the assignment
and therefore both digests. The reader does not establish the correctness or
exclusive enforcement of that mapping.

A fresh Git tip is an opaque currentness token. It is never transformed into a
numeric fence, Fabric SQL run ID or authenticated writer identity. Actual N023
transport composition and the source-owned run-to-lease assignment remain separate.

## Bounds and races

Explicit path count/depth/byte bounds, file/total byte bounds, metadata output bound,
operation timeout and evidence age are required. The implementation additionally
caps accepted configuration to finite maxima. One long-lived instance retains its
I/O slot after a caller timeout until the actual dependency and descriptor cleanup
settle. Repeated captures cannot accumulate unresolved work. Late results cannot
satisfy the timed-out caller; subsequent stages check the monotonic deadline.
Clock values are synchronous epoch milliseconds. Ordinary accidentally rejected
native-Promise clock values are consumed but invalid; no fabricated time is used.

This is a cooperative snapshot, not arbitrary hostile-filesystem race immunity or
an atomic multi-file transaction. Files may change immediately after the checks,
and a malicious actor can attempt change-and-restore races between observations.
Injected I/O and identity/lease readers are trusted infrastructure. Constructing
many readers does not impose a global process/I/O limit. No filesystem sandbox,
credential boundary or continuous enforcement is claimed.

## Verification and remaining work

Run `node --experimental-strip-types --test apps/desktop/test/resource-input-snapshot.test.mjs`.
The focused suite uses actual temporary repositories and actual filesystem bytes,
with injected boundaries only for deterministic races/timeouts and lease evidence.
Coverage includes tracked/untracked/ignored and explicit absent paths, invalid
paths, symlinks, hardlinks, FIFO/gitlinks, HEAD/index/flag changes, growth and byte
budgets, earlier-file mutation, parent replacement, independent identity, optional
lease binding/expiry, weak receipt identity and retained timeout occupancy.

An early candidate used only stage metadata. Independent review reproduced
`--assume-unchanged` returning `same`; builder regressions also exposed skip-worktree
and nested-root acceptance. These fail on preserved source and pass with the
expanded logical index view and exact top-level check. This was a real metadata
contract gap, not a claim that the selected bytes changed.

The module does not select dependencies, bind actual delivered chain instructions
or compiler context automatically, persist task-to-lease mappings, manufacture an
R1 ownership/fence verdict, create a complete worker inventory, or compose resource
admission. Those source-owned local implementation steps remain executable; they
are not implicitly blocked on portable protocol owner approval. Production
activation, real transport credentials where needed, schema ordering and supported
native acceptance keep their separate prerequisites.

Builder focused run:31 tests PASS, exit0. Four production-source negative controls
(raw-byte hash, final file stamp, retained slot, async clock rejection) each fail
its selected check with exit1. The unchanged scope/operations gates pass on the
combined source overlay. These are local source checks, not native composition.
