#!/usr/bin/env python3
"""FIX-PF-07.02 — crash-safe dispatch, REWRITTEN 2026-09-10 by FA-02.

WHAT THIS FILE USED TO ASSERT, AND WHY THAT WAS WORSE THAN ASSERTING NOTHING.

The original fix gave the chain its own dispatch guard: a conditional update
moving a follower backlog -> `dispatching`, a `chain.dispatch@1` outbox event
before the spawn, and a pass at the top of each tick re-driving rows stuck in
`dispatching`. This file pinned that mechanism two ways:

  * by SOURCE STRING — it required `.update('project_tasks', { status:
    'dispatching' })` and, verbatim, the line `if (!casWon?.length) continue`;
  * by a MODEL — a Python `Store` class with its own `cas()` that always
    succeeds, driven through a crash script.

Both were green from the day they were written. Neither had ever touched the
database, where `project_tasks_status_check` has allowed backlog, running,
review, done, cancelled, open, finished and abandoned since migration one and
has never allowed `dispatching`. Every one of those writes was rejected;
`error` was destructured away; `!casWon?.length` read the empty answer as
another process winning the race. NO CHAIN HAS EVER ADVANCED IN THIS PRODUCT,
and this file reported that mechanism sound on every run.

A test that re-implements the mechanism it is testing verifies that the model is
self-consistent. That is not a property of the product, and it is indistinguishable
from a passing test until somebody runs the real thing.

WHAT IT ASSERTS NOW. The properties are the same four the original cared about —
one winner, a durable intent before the spawn, nothing lost to a crash, a clean
failure that does not strand the follower — but each is proved where it can
actually fail:

  * the BEHAVIOUR lives in `apps/desktop/test/chain.test.mjs`, against the real
    database, the real admission command and the real lease. Three concurrent
    advances there produce one spawn and one TaskRun.
  * this file keeps only what a source check can honestly own: that the invented
    status is GONE, that the chain goes through the shared admission command,
    that an unreadable answer is not read as a lost race, and that the intent is
    journalled before the spawn.

Stdlib only.
"""
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CHAIN = os.path.join(ROOT, "apps", "desktop", "src", "main", "chainAdvance.ts")
SHARED = os.path.join(ROOT, "apps", "desktop", "src", "shared", "admission.ts")
PROBE = os.path.join(ROOT, "apps", "desktop", "test", "chain.test.mjs")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def t_the_invented_status_is_gone():
    s = read(CHAIN)
    assert "'dispatching'" not in s, (
        "the chain still writes or reads `dispatching`, a status "
        "`project_tasks_status_check` does not allow — every such write is rejected"
    )


def t_the_dispatch_goes_through_the_shared_command():
    s = read(CHAIN)
    assert "deps.admitExisting(" in s, \
        "the chain does not call the shared admission; it has a mechanism of its own again"
    admit = s.index("deps.admitExisting(")
    spawn = s.index("deps.startTask(")
    assert admit < spawn, "the spawn happens before the admission that authorises it"


def t_an_unreadable_answer_is_not_a_lost_race():
    s = read(SHARED)
    assert "'unavailable'" in s, "the admission reading has no unavailable outcome"
    body = s[s.index("export function admissionOutcome"):]
    assert "if (error)" in body, \
        "admissionOutcome ignores the error, which is the exact defect this file exists for"
    assert re.search(r"typeof receipt\.admitted !== 'boolean'", body), \
        "a missing verdict is not distinguished from a refusal"


def t_intent_is_journalled_before_the_spawn():
    s = read(CHAIN)
    intent = s.index("phase: 'intent'")
    spawn = s.index("deps.startTask(")
    assert intent < spawn, "the outbox intent is journalled after the spawn it is meant to survive"
    assert "type: 'chain.dispatch@1'" in s
    # And the type is REGISTERED. It was not, and `append_event` refuses an
    # unregistered type — the second of the three swallowed failures.
    migrations = os.path.join(ROOT, "supabase", "migrations")
    registered = any(
        "'chain.dispatch@1'" in read(os.path.join(migrations, f))
        and "event_types" in read(os.path.join(migrations, f))
        for f in os.listdir(migrations)
        if f.endswith(".sql")
    )
    assert registered, "chain.dispatch@1 is not registered in event_types; every append of it throws"


def t_a_failed_spawn_releases_the_lease():
    s = read(CHAIN)
    catch = s[s.index("catch (spawnError)"):]
    assert "delete('leases')" not in s and "deps.endRun(" not in s, \
        "chain must not compensate a launch whose durable begin belongs to the shared coordinator"
    launch = read(os.path.join(ROOT, "apps/desktop/src/main/managedLaunch.ts"))
    assert "if (!ownsBegin)" in launch and "command('fail_task_launch'" in launch, \
        "only the begin winner may invoke the exact-generation failure command"
    assert "launchAdmission: { receipt: admitted.receipt, sessionId }" in s, \
        "the admitted generation must reach the shared coordinator"


def t_the_behaviour_is_proved_against_the_real_path():
    # The point of the rewrite. These names are the cases in the real probe; if
    # one is renamed or deleted, this file stops claiming a proof it no longer has.
    s = read(PROBE)
    for phrase in [
        "three advances of one window start the follower exactly once",
        "exactly one TaskRun exists for the follower",
        "advancing a follower creates no second task",
        "an admission that could not be asked starts nothing",
    ]:
        assert phrase in s, f"the behavioural proof named here is not in the probe: {phrase}"


def main():
    case("the invented `dispatching` status is gone", t_the_invented_status_is_gone)
    case("the dispatch goes through the shared admission command",
         t_the_dispatch_goes_through_the_shared_command)
    case("an unreadable answer is not read as a lost race",
         t_an_unreadable_answer_is_not_a_lost_race)
    case("the intent is journalled before the spawn, and its type is registered",
         t_intent_is_journalled_before_the_spawn)
    case("a failed spawn releases the lease", t_a_failed_spawn_releases_the_lease)
    case("the crash properties are proved against the real path, not against a model of it",
         t_the_behaviour_is_proved_against_the_real_path)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        sys.exit(1)
    print("\nall green")


main()
