# Controlled managed-pool completeness: bounded next design

Status: storage slice A has reviewed N034 implementation; concrete composition slice B remains DESIGN ONLY. This continues ADR-0154. Neither storage alone nor N032 proves complete inventory. See [the N034 contract](resource-pool-registry.md) and [source evidence](../../reports/2026-10-13-resource-admission-contract/raw/n034/README.md).

## Exact existing gaps

- N031 `scan` validates current files and per-unit parent chains, but has no durable expected total/head. Deleting an entire valid unit chain is invisible to enumeration. Its `.register.lock` excludes concurrent writers only during one append; snapshots do not hold it. This is sufficient for its explicitly incomplete output, not completeness.
- N031 `current` binds the current invocation, human policy and adapter manifest. `heldRow` refuses if ANY row is prior-binding. Thus a new boot or policy cannot currently append beside retained historical units. Do not remove these checks wholesale: launch/read-handle currentness must stay strict; historical occupancy validation needs a separate scope.
- N032 registers before resource admission and binds actual private resource receipt and held PTY object. However a manifest alone proves no exclusive producer domain; no factory holds lifetime writer ownership. `index.ts` configures no resource units, sampler or publisher. Electron single-instance locking is not a registry completeness proof.
- N022 accepts a complete exact host/boot/pool/policy worker list; feeding N031's known subset would be false. N025 publishes measured observations; N027 reads coherent reserved accounting. Neither proves logical launch coverage.

## Smallest defensible scope

One installation's explicitly provisioned logical managed-only pool, one allowed estate initially, one current writer. Derive one registry path from the actual installation's canonical app-data root and `(hostInstanceId,poolId)`; estate/policy/boot must NOT select a new path that drops old units. A second estate for that pool refuses until multi-estate composition exists. Arbitrary caller-selected alternative roots cannot represent the same pool.

The actual controlled factory, not a task flag, defines enrollment. Only its ordinary required launch calls belong to this logical pool. Legacy/free PTYs, backend launches and external CLIs remain outside, explicitly; physical counters still include them. This is cooperative Fabric source coverage, not OS sandboxing or protection against a same-user adversary modifying every trusted file.

Use a fresh versioned registry genesis, durably provisioned before ANY controlled start can be granted. A missing/empty directory after provisioning is unknown, not a new pool. A previously populated N031 v1 directory cannot be silently adopted as complete. Legacy import needs a later evidence-backed migration; it may remain readable/incomplete. Keep current default behavior unchanged.

## A. Actual exclusive registry writer and complete committed set

New internal `resourcePoolRegistry.ts`, consumed by a narrow N031 storage extension, supplies a private writer capability. No `complete:true` callback or caller-supplied list is accepted. Open it using the actual fixed installation identity/root and finite limits. It acquires an O_EXCL lifetime ownership file, records a random writer epoch bound to the registry genesis, and fsyncs file+directory before issuing any capability. Retain the lifetime lock FILE and its original inode and canonical bytes; use fresh bounded descriptors and explicitly close each one. The initial open-descriptor representation caused a real GC failure in abandoned writers and was corrected in N034. Replacement, parent/root drift or unknown bytes revoke future operations. An existing writer file refuses acquisition; PID/liveness/TTL do not permit stealing.

Every append and complete snapshot passes through one pool-wide retained I/O slot. N031's actual writes participate, rather than a parallel shadow registry. A successful append durably commits an ordered head containing sequence, exact event-file digests and predecessor-head digest; acknowledge only after event/head/directory fsync. A snapshot under that same writer serialization reads the full bounded committed head+set and verifies all expected records and chains. Missing whole chains, duplicate sequence/id, unknown extra files, truncated head, unresolved append, overflow or failed fsync produce unknown. The head is the finite cardinality/completeness obligation absent today; simply rescanning the directory is insufficient.

The exact on-disk commit format must keep no acknowledged head pointing at absent events. A crash between event and head, or a lost write reply, is retained ambiguity. Exact same-operation recovery may re-establish durability and reconcile the committed head; it never repeats a new unit identity or hides a partial file. Do not claim tamper resistance against coordinated rewriting of both head and history.

Snapshot historical validity is distinct from permission to operate a handle. Validate old records against their immutable admitted registry policy/coverage epoch and installation/pool genesis. Count every unretired registration once, including pre-admission intent, unbound/unknown spawn, prior invocation, old policy or stale task membership. None is observed-live merely because charged. Keep N028/intent currentness checks for NEW launches and exact current handles. Do not require historical task membership to still exist merely to retain its charge. Unknown policy/coverage history remains unknown rather than being skipped.

Bounds are explicit maxUnits, maxEvents, maxEventBytes, maxRegistryBytes and bounded directory entries/pages. Stop at limit+1; never expose a partial complete result. Safe-integer counts/sums; no unbounded allocations. Timeout revokes follow-on work but retains the single outstanding operation until every started dependency settles. Full registry refuses new starts, not garbage collection. This slice has NO retirement, so capacity can intentionally remain exhausted.

## B. Concrete entry coverage, not a declaration

A new `createControlledManagedPool` source composition imports the actual N028 manager, N031 writer-backed store, N032 units, ResourceLaunchAdapter and existing createManagedLaunch/PtyManager. It returns only the actual controlled `launch` and a snapshot/sampler consumer; it does not expose arbitrary append, membership toggles or a completeness setter. Trusted configured policy, explicit limits and existing concrete preflight dependencies remain inputs; this does not manufacture R1 held ownership or complete input closure.

Before the managed path can obtain a native unit handle, it obtains a private single-use creation ticket from the actual registry-backed confirmed intent. Extend the existing PTY owned-unit record to retain that exact ticket and its source-owned validator, rather than accepting a caller boolean. A synchronous ticket/epoch/current-writer check immediately after final SQL and before `this.spawn` prevents starts from a factory closed during an earlier await; do not add an asynchronous operation to the SQL-to-spawn interval. The ticket is bound to exact prepared/intent/native handles and cannot be copied or moved to another pool/session/factory. Ambiguous spawn consumes it permanently and keeps the registered unit.

The complete snapshot is available only from this live source composition holding the writer and validated genesis/head, and reports `semantics:conservative_unretired_units`. Its exact N022 worker projection uses current observation boot/time/human-policy fields plus ALL retained unit IDs, even if units originated in older boots. Preserve full current policy binding revision and registry epoch in the richer evidence receipt. Source implementation/audit proves which entry paths call this factory; a manifest is merely a digest-bound audit aid. The actual index opt-in composition still stays unconfigured until the separate trusted policy/preflight/input authority exists.

Complete means: every logical unit the controlled domain could have created has a committed retained record at this serialized snapshot. It does NOT mean every record has a live process, every host process belongs to this pool, currentness is atomic with future admission, or execution is authorized. Existing R2 atomic admission remains the future resource authority. No overlap credit is inferred from this conservative list. This is a material throughput limitation: the pre-admission intent already counts one unit, while R1 adds the requested demand and N027 credits no overlap; a capacity-one pool can refuse its first attempt. Active held reservations and observed retained units may also be charged twice. A later exact source-bound own-intent/reservation overlap contract must resolve this for efficient activation, or policy behavior must explicitly accept the conservative refusal. Never subtract an echoed attempt or fabricate zero observations.

## Crash and restart boundary

Clean handoff: synchronously mark writer closing; reject new tickets/operations; drain all started creation and registry operations; seal the epoch with its durable final head; invalidate all tickets; only then remove the owner file using the still-owned exact identity and fsync the directory. Current spawned units and unknown providers stay charged. A new invocation can acquire the released lock, verify the sealed predecessor and complete historical set, and count old unresolved units without adopting process/PID ownership.

Unclean crash or close deadline: retain owner file and state; a new writer refuses. A reader may report a known incomplete subset, never complete/zero. There is no automatic stale lock stealing. A crash after seal but before unlink is conservatively blocked too; a future recovery protocol must solve its race instead of check-then-unlink from competing successors. This bounded first slice deliberately supports clean restart and explicit crash uncertainty, not autonomous recovery from every crash.

Missing genesis, mismatched root, corrupt history, foreign writer, unknown policy epoch and retained I/O all keep complete unavailable. No registry record, tree exit or provider uncertainty retires a unit here.

## File ownership and acceptance

Proposed two dependent implementation packets, to avoid claiming storage alone closes coverage:
1. `resourcePoolRegistry.ts`, focused real-filesystem test, its contract doc; narrow N031 storage integration owned by the N031 author. Private lifetime writer + genesis/head verification + serialized writes/snapshots; output remains incomplete until concrete factory is attached.
2. Concrete controlled composition module and narrow N032/managedLaunch/pty/index forwarding (still no configured defaults), sampler wiring and tests. Only the actual wired factory can expose complete conservative occupancy. Root owns graph/CI/map. No pending SQL edit required solely for local set completeness; actual activation must also bind this fixed host/pool registry to N025/N027 and R2 policy.

Required actual-source negatives: two processes attempt same writer (one winner); alternate root for same installation/pool refuses; copied ticket or foreign factory cannot spawn; writer closes during asynchronous SQL guard => no spawn; post-intent uncertain spawn remains charged; zero registry without durable genesis unknown; delete full old unit chain => unknown; concurrent snapshot/append yields a whole serialized set; mid-fsync timeout holds the slot across repeated calls; byte/record/page exhaustion refuses; clean restart retains prior unknown units; old task membership deletion does not erase historical charge; policy change preserves older admitted epochs; crash with owner file refuses new writer and never reports complete; malformed historical epoch refuses. Use real FS and actual modules with synthetic native boundaries; native/provider/installed acceptance separate.

## Decision for review

Recommend the no-steal lifetime writer plus sealed clean-handoff first, with explicit blocked unclean restart, rather than claiming a recoverable distributed lease. This is locally executable source work. Provider proof is needed for retirement, not for counting retained uncertain units; board consent is not a code prerequisite. Positive production completeness still needs this concrete composition, fixed registry mapping and actual activation evidence; N031/N032 alone do not supply them.

## Delivery cost to measure in the next iteration

The current source workflow runs fast before its source commit. The publisher then runs
fast before export and after writing its two publication-only outputs when Fabric source
changed (`scripts/workspace.mjs`, `fabricChanged` branches). N031's measured full run was
1208.8seconds ([receipt](../../reports/2026-10-13-resource-admission-contract/raw/closing/n031-fast.json)). Thus repeated
whole-source validation is a concrete optimization target; this run still follows the
existing contract. A future reusable gate receipt must bind the exact source tree,
toolchain and dependency identity, check-command version, environment prerequisites and
explicit NOT_RUN stages. A source hash alone cannot attest unchanged dependencies or
turn a skipped database/native stage into acceptance. Review that contract before changing
the publisher, then prove stale/dependency/environment drift invalidates the cache.

The [source-specific publication reuse proposal](publication-reuse-packet.md) narrows optimization to one proved compiler check closure. HEAD, actual parser checkout and realized execution environment also affect the gate; a Git tree alone is insufficient. No current check is bypassed.
