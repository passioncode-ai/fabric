#!/usr/bin/env python3
"""FIX-PF-07.01 — chain advance reuses the existing follower identity and is
idempotent (sherlock audit, PF-07).

The finding: chainAdvance picked a backlog follower and called startTask WITHOUT
its taskId. The real startTask minted a new UUID and never changed the original
follower, whose status stayed `backlog` — so two consecutive advancer ticks
spawned two tasks and left follower B in backlog. The `running` mutex is local
to one process, so it cannot stop a second call.

The fix under test:
* chainAdvance passes `followerId: follower.id` and an idempotency key
  (run/node = the follower, plus its predecessor) to startTask, and dedups
  within a tick;
* startTask uses `input.followerId ?? randomUUID()` — advancing the existing
  task rather than minting a new one — and records the idempotency key;
* a repeated chain advance maps to ONE follower/attempt (modelled as
  behaviour).

Standard library only.
"""
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CHAIN = os.path.join(ROOT, "apps", "desktop", "src", "main", "chainAdvance.ts")
INDEX = os.path.join(ROOT, "apps", "desktop", "src", "main", "index.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def t_chainadvance_passes_follower_identity():
    s = read(CHAIN)
    assert "followerId: follower.id as string" in s, \
        "chainAdvance no longer passes the existing follower id — the finding itself"
    keys = re.findall(r"idempotencyKey:\s*`chain:\$\{follower\.id\}:([^`]+)`", s)
    assert keys, "the idempotency key is no longer derived from the follower id"
    # FIX-PF-08.01 widened this key from ONE predecessor (`link.target_id`, the
    # shape this assertion was first written against) to the COMPLETE
    # predecessor set. The intent is unchanged and is what is held here: the key
    # binds the follower to what it waited on. A follower-only key still fails.
    fanin = [k for k in keys if "target_id" in k]
    assert fanin, "the idempotency key (follower + predecessor) is missing"
    assert any(".sort()" in k and ".join(" in k for k in fanin), \
        "the key does not pin the COMPLETE predecessor set: edge order would mint two keys for one diamond (PF-08.01)"


def t_chainadvance_dedups_within_a_tick():
    s = read(CHAIN)
    assert "const dispatched = new Set<string>()" in s, "no per-tick dedup set"
    assert "if (dispatched.has(follower.id as string)) continue" in s, \
        "a follower can be dispatched twice in one tick"
    assert "dispatched.add(follower.id as string)" in s, "the dispatch is not recorded"


def t_starttask_reuses_id_and_records_key():
    s = read(INDEX)
    # The follower's own id comes first; a caller-chosen NEW task id (0.3.3 onboarding retry) may sit between it
    # and the fresh UUID, but never ahead of the follower.
    assert re.search(r"const id = input\.followerId \?\? (input\.taskId \?\? )?randomUUID\(\)", s), \
        "startTask still mints a fresh UUID unconditionally — no advance of the existing task"
    assert "followerId?: string" in s and "idempotencyKey?: string" in s, \
        "startTask's input type does not accept followerId/idempotencyKey"
    assert "idempotency_key: input.idempotencyKey ?? null" in s, \
        "the started event does not record the idempotency key"


# ---------------- the idempotency, run as behaviour


class MockStore:
    """A follower is selectable only while in backlog; advancing it (its status
    leaving backlog) removes it from the next tick's selection."""

    def __init__(self):
        self.status = {"B": "backlog"}
        self.started = []   # (task_id, idempotency_key)

    def backlog_followers(self):
        return [fid for fid, st in self.status.items() if st == "backlog"]


def start_task(store, follower_id, idempotency_key, use_follower_id):
    # use_follower_id True = the fix; False = the old randomUUID path (modelled
    # as a fresh, distinct id each call that never touches the follower's status)
    import itertools
    if not hasattr(start_task, "_seq"):
        start_task._seq = itertools.count(1)
    if use_follower_id:
        task_id = follower_id
        store.status[follower_id] = "started"   # advances the EXISTING task
    else:
        task_id = f"uuid-{next(start_task._seq)}"  # a new task; follower untouched
    store.started.append((task_id, idempotency_key))
    return task_id


def advance(store, use_follower_id):
    dispatched = set()
    for fid in store.backlog_followers():
        if fid in dispatched:
            continue
        start_task(store, fid, f"chain:{fid}:pred", use_follower_id)
        dispatched.add(fid)


def t_repeated_advance_maps_to_one_attempt_with_the_fix():
    store = MockStore()
    advance(store, use_follower_id=True)
    advance(store, use_follower_id=True)   # a second tick
    ids = {tid for tid, _ in store.started}
    assert store.started, "nothing was started"
    assert ids == {"B"}, f"the fix spawned more than one task identity: {ids}"
    assert len(store.started) == 1, \
        f"follower B was advanced {len(store.started)} times, not once"
    assert store.status["B"] == "started", "the follower stayed in backlog after advance"


def t_the_old_path_would_have_double_spawned():
    store = MockStore()
    advance(store, use_follower_id=False)
    advance(store, use_follower_id=False)
    assert len(store.started) == 2 and store.status["B"] == "backlog", \
        "the model does not reproduce the finding — the regression proves nothing"


def main():
    case("chainAdvance passes the existing follower id and an idempotency key",
         t_chainadvance_passes_follower_identity)
    case("chainAdvance dedups a follower within a tick", t_chainadvance_dedups_within_a_tick)
    case("startTask reuses followerId and records the idempotency key",
         t_starttask_reuses_id_and_records_key)
    case("a repeated advance maps to one follower/attempt (the fix)",
         t_repeated_advance_maps_to_one_attempt_with_the_fix)
    case("the old randomUUID path would have double-spawned (the finding)",
         t_the_old_path_would_have_double_spawned)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
