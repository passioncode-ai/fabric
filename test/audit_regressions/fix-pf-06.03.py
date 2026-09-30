#!/usr/bin/env python3
"""FIX-PF-06.03 — the append-only persistence contract is a bounded decision
(sherlock audit, PF-06).

The artifact under test (docs/evidence/plans/task-pipeline-persistence-contract.md):
* decides whether new schema is needed, with the measured gap;
* reserves EXACT new migration/ADR ids that continue the real sequences and
  do not collide with any existing artifact;
* old migrations/ADRs stay read-only (the reservation creates, never edits);
* records recovery approach and upgrade criteria;
* does NOT declare migration execution done — and the reserved files must
  not exist.

Standard library only.
"""
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DOC = os.path.join(ROOT, "docs", "evidence", "plans",
                   "task-pipeline-persistence-contract.md")
MIG = os.path.join(ROOT, "supabase", "migrations")
ADR = os.path.join(ROOT, "docs", "adr")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def flat():
    with open(DOC, encoding="utf-8") as fh:
        return " ".join(fh.read().split())


def t_decision_sections_present():
    d = flat()
    assert "Is new DB schema needed?" in d and "YES" in d
    assert "## 3. Recovery approach" in d
    assert "## 4. Upgrade criteria" in d
    assert "ADR-0009" in d, "the decision does not cite the promise it serves"


def t_not_executed_and_files_absent():
    d = flat()
    assert "DECIDED, NOT EXECUTED" in d
    assert "refused as evidence" in d
    migs = sorted(f for f in os.listdir(MIG) if f.endswith(".sql"))
    latest = migs[-1].split("_")[0]
    for rid in re.findall(r"`(\d{14}_[a-z_]+\.sql)`", d):
        if rid.split("_")[0] <= latest:
            continue                       # a cited EXISTING artifact, not a reservation
        assert not os.path.exists(os.path.join(MIG, rid)), \
            f"reserved migration {rid} already exists — the decision claims execution"
    # The reserved id is read from the document, never hardcoded here: the
    # document's own collision rule re-reserves the NEXT free id, and a test
    # pinned to one number would refuse the very rule it is checking.
    m = re.search(r"docs/adr/(\d{4}-[a-z-]+\.md)", d)
    assert m and not os.path.exists(os.path.join(ADR, m.group(1))), \
        "the reserved ADR already exists"


def t_reserved_ids_continue_the_real_sequences():
    migs = sorted(f for f in os.listdir(MIG) if f.endswith(".sql"))
    latest_mig = migs[-1].split("_")[0]
    d = flat()
    assert f"`{migs[-1]}`" in d, \
        "the decision does not cite the actual latest migration"
    reserved = re.findall(r"`(\d{14})_[a-z_]+\.sql`", d)
    new_ids = [r for r in reserved if r > latest_mig]
    assert len(new_ids) >= 2 and all(r > latest_mig for r in new_ids), \
        f"reserved ids do not continue the sequence past {latest_mig}"
    adrs = sorted(f for f in os.listdir(ADR) if re.match(r"^\d{4}-", f))
    latest_adr = int(adrs[-1][:4])
    m = re.search(r"docs/adr/(\d{4})-", d)
    # The global allocator may have issued numbers to another branch. Require
    # an explicit authority-addressed receipt for EVERY gap, not an arbitrary jump.
    issued = {int(n) for n, _ in re.findall(r"ADR-(\d{4}) at `([a-f0-9]{40})`", d)}
    expected = latest_adr + 1
    while expected in issued:
        expected += 1
    assert m and int(m.group(1)) == expected, \
        f"the reserved ADR id does not continue from {latest_adr:04d}"


def t_old_artifacts_read_only():
    d = flat()
    assert "read-only" in d and "never renumbers, edits or reuses" in d
    assert "re-reserves the NEXT free id" in d, \
        "the collision rule is missing — a reservation is not a lock"


def t_append_only_and_gate():
    d = flat()
    assert "append-only" in d
    assert "inserts a new version row, never updates" in d
    assert "schema_version()" in d and "fails closed" in d


def main():
    case("the decision sections are present and cite ADR-0009",
         t_decision_sections_present)
    case("execution is NOT claimed and the reserved files do not exist",
         t_not_executed_and_files_absent)
    case("reserved ids continue the real migration and ADR sequences",
         t_reserved_ids_continue_the_real_sequences)
    case("old artifacts are read-only; collisions re-reserve",
         t_old_artifacts_read_only)
    case("append-only recovery + the schema_version gate are recorded",
         t_append_only_and_gate)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
