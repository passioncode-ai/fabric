#!/usr/bin/env python3
"""Bounded resource waiter for one full `bash scripts/ci.sh fast` on an exact committed candidate.

Admission: no other ci.sh process, free bytes >= REQUIRED and load1 <= MAX_LOAD on two samples
SAMPLE_INTERVAL apart. Binds HEAD, index tree and the tracked-path hash set before and after.
Writes one JSON receipt; grants no merge, publication, graph closure or consent.
"""
import hashlib, json, os, subprocess, sys, time, datetime

repo, expected_head, receipt_path, log_path = sys.argv[1:5]
REQUIRED = 3 * 1024**3
MAX_LOAD = 56.0
SAMPLE_INTERVAL = 30
WAIT_SECONDS = int(os.environ.get("WAIT_SECONDS", "7200"))
EXEC_SECONDS = 4500
started = time.time()
deadline = started + WAIT_SECONDS


def git(*a):
    return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True, check=True).stdout.strip()


def manifest():
    paths = git("ls-files", "-z").split("\0")
    h = hashlib.sha256()
    count = 0
    for p in sorted(x for x in paths if x):
        if p == "workspace" or p.endswith("/.graph.lock"):
            continue
        fp = os.path.join(repo, p)
        if os.path.isfile(fp) and not os.path.islink(fp):
            h.update(p.encode() + b"\0" + hashlib.sha256(open(fp, "rb").read()).digest())
            count += 1
    return h.hexdigest(), count


def state():
    return {"head": git("rev-parse", "HEAD"), "indexTree": git("write-tree"),
            "dirty": [l for l in git("status", "--porcelain").splitlines()
                      if not l.endswith(" workspace") and not l.endswith(".graph.lock")]}


def sample():
    st = os.statvfs(repo)
    free = st.f_bavail * st.f_frsize
    load1 = os.getloadavg()[0]
    others = subprocess.run(["pgrep", "-f", "scripts/ci.sh"], capture_output=True, text=True).stdout.split()
    others = [p for p in others if int(p) != os.getpid()]
    return {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "freeBytes": free,
            "load1": round(load1, 2), "otherCi": len(others),
            "ok": free >= REQUIRED and load1 <= MAX_LOAD and not others}


def write(r):
    tmp = receipt_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(r, f, indent=2)
        f.write("\n")
    os.replace(tmp, receipt_path)


before = state()
man_before, count = manifest()
r = {"expectedHead": expected_head, "headBefore": before["head"], "indexTreeBefore": before["indexTree"],
     "trackedPathCount": count, "sourceManifestSha256": man_before,
     "requiredFreeBytes": REQUIRED, "maximumLoad1": MAX_LOAD, "requiredConsecutiveSamples": 2,
     "sampleIntervalSeconds": SAMPLE_INTERVAL, "waitDeadlineUTC": datetime.datetime.fromtimestamp(deadline, datetime.timezone.utc).isoformat(),
     "executionDeadlineSeconds": EXEC_SECONDS, "pid": os.getpid(),
     "limits": ["Full fast only; no graph closure, merge, publication, installed update or consent",
                "One heavy slot: admission also waits for no other scripts/ci.sh process",
                "Manifest excludes the workspace gitlink and the graph lock"],
     "status": "WAITING", "samples": []}
if before["head"] != expected_head or before["dirty"]:
    r.update(status="NOT_RUN_CANDIDATE_MISMATCH", dirty=before["dirty"]); write(r); sys.exit(2)
write(r)

ok_streak = 0
while time.time() < deadline:
    s = sample()
    r["samples"] = (r["samples"] + [s])[-12:]
    ok_streak = ok_streak + 1 if s["ok"] else 0
    write(r)
    if ok_streak >= 2:
        break
    time.sleep(SAMPLE_INTERVAL)
else:
    r["status"] = "NOT_RUN_RESOURCE_WAIT_EXPIRED"; write(r); sys.exit(3)

r["status"] = "RUNNING"
r["startedAtUTC"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
write(r)
t0 = time.time()
min_free = None
with open(log_path, "w") as log:
    p = subprocess.Popen(["bash", "scripts/ci.sh", "fast"], cwd=repo, stdout=log, stderr=subprocess.STDOUT,
                         start_new_session=True)
    while p.poll() is None:
        free = os.statvfs(repo).f_bavail * os.statvfs(repo).f_frsize
        min_free = free if min_free is None else min(min_free, free)
        if time.time() - t0 > EXEC_SECONDS:
            os.killpg(p.pid, 15); time.sleep(10)
            if p.poll() is None:
                os.killpg(p.pid, 9)
            break
        time.sleep(5)
    code = p.wait()
elapsed = round(time.time() - t0, 2)
after = state()
man_after, _ = manifest()
r.update(exitCode=code, elapsedSeconds=elapsed, minFreeBytesDuringRun=min_free,
         finishedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),
         headAfter=after["head"], indexTreeAfter=after["indexTree"], dirtyAfter=after["dirty"],
         sourceManifestSha256After=man_after, sourceUnchanged=(man_after == man_before and after["head"] == before["head"]))
if elapsed > EXEC_SECONDS:
    r["status"] = "FAIL_EXECUTION_DEADLINE"
elif not r["sourceUnchanged"]:
    r["status"] = "INVALID_SOURCE_CHANGED"
else:
    r["status"] = "PASS" if code == 0 else "FAIL"
write(r)
sys.exit(0 if r["status"] == "PASS" else 1)
