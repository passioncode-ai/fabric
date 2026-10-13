# Explicit host policy and concrete sampler candidate

Temporary builder artifact for root integration and independent review. No repository/configuration/database was modified. Source regions refer to the owning activation-prerequisites document. This is only the policy/read producer part of packet1; pending107 publication/readback and production composition remain separate.

`readResourceHostPolicy` validates an explicit independently bound installation/pool policy, units and role demand profiles; copies/freezes it; never invents numeric capacity or demand defaults. `createResourceHostSampler` requires the trusted existing host identity provider separately and rechecks host/invocation after observation. No task-supplied identity proves ownership.

Real defaults use `os.totalmem`, `os.freemem`, two `os.cpus` cumulative-counter snapshots and bigint `fs.statfs` behind canonical realpath/device checks. Used memory is total minus free, conservatively the larger of two endpoints; it is not a pressure/available-memory estimator. Disk charge is total blocks minus nonprivileged available blocks, not the configured quota. CPU is rounded-up aggregate busy milliCores over the measured interval, not load average, instantaneous peak, future demand or energy. Physical totals and configured ceilings remain distinct. No reserved or overlap vector is manufactured.

Workers require a complete trusted pool inventory, bound to host/invocation/pool/revision and fresh epoch; PTY sessions, reservation counts or a missing reader cannot prove zero. Absent or invalid inventory returns nullable workerSlots and no publishable vector, while preserving valid physical axes. Real OS smoke therefore deliberately remains overall unknown.

Timestamp `atMs` is wall-clock earliest sample time, `completedAtMs` is wall-clock completion, and `durationMs` is monotonic elapsed time. Staleness, backwards clocks, host restart, disk remount/path mismatch, malformed values, counter resets/topology changes and integer overflow refuse the observation. Ordinary accidental rejected async clocks are consumed while remaining invalid.

One long-lived sampler has one retained I/O slot. Timeout returns unknown but does not free the slot until the actual dependency settles. Late completion cannot initiate another default disk subread or any later sample stage. Ten repeat calls stay bounded to one underlying request. Injected dependencies are trusted code, not a sandbox; a custom dependency can hide internal work, and replacing the sampler cannot cancel its old work. There is no scheduler/timer loop, database writer or installed policy.

Focused test command: `node --experimental-strip-types --test apps/desktop/test/resource-host-sampler.test.mjs`, exit0,31 tests. One test performs real read-only OS/statfs sampling without printing machine inventory. Four production-source plants (worker zero, CPU zero, slot bypass, unbound host) each cause selected tests to fail exit1. See receipt.json and negative-controls.json.

NOT_RUN: independent review, TypeScript gate, owned SQL write/readback, production composition, active policy/migrations, other host native acceptance. No provider calls or energy-saving claim.

Correction: independent real OS smoke exposed an early timer wake (49.6595ms for a50ms window). The production sampler now waits until a monotonic target, with at most3 pause requests and the existing whole-operation deadline. Two deterministic regressions fail before/pass after. A bounded160-real-sample rerun has160 physical readings, zero unavailable results, minimum50.423875ms; workerSlots remains unknown in all160. This is an observed run, not proof every future OS read succeeds. Initial source and failure diagnostics are preserved.
