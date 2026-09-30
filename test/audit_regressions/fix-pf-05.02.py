#!/usr/bin/env python3
"""FIX-PF-05.02 — Fabric materializes context as content-addressed refs
(sherlock audit, PF-05).

The finding: the context pack and brief existed only under
`{root}/sessions/{id}/` — a local path, destroyed with the session. A path is
not a portable identity.

The fix under test (apps/desktop/src/main/executionPacket.ts, driven through
node's native type-stripping):
* materialize() stores each part at blobs/<sha256> and the packet names parts
  by DIGEST, never by path;
* a store moved to another root verifies with the SAME digests;
* a missing blob blocks the start (verify → ok:false naming the part);
* a tampered blob is caught by re-hashing, not trusted by filename;
* sessionBundle wires it: a packet that fails to verify escapes the
  compile-failure catch and blocks the launch.

Standard library + node only.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
EP = os.path.join(ROOT, "apps", "desktop", "src", "main", "executionPacket.ts")
SB = os.path.join(ROOT, "apps", "desktop", "src", "main", "sessionBundle.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def run_js(js, *argv):
    r = subprocess.run(["node", "-e", js, EP, *argv],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:400]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


MATERIALIZE = (
    "import(process.argv[1]).then(m => {"
    "  const pkt = m.materialize(process.argv[2],"
    "    {sessionId:'s1', projectId:'p1', taskId:null},"
    "    [{name:'context', bytes:'the pack'}, {name:'brief', bytes:'the brief'}]);"
    "  console.log(JSON.stringify({pkt, check: m.verify(process.argv[2], pkt)}));"
    "});"
)

VERIFY = (
    "import(process.argv[1]).then(m => {"
    "  const pkt = JSON.parse(process.argv[3]);"
    "  console.log(JSON.stringify(m.verify(process.argv[2], pkt)));"
    "});"
)


def t_identity_is_digest_not_path():
    d = tempfile.mkdtemp()
    out = run_js(MATERIALIZE, os.path.join(d, "rootA"))
    assert out["check"] == {"ok": True}
    for ref in out["pkt"]["refs"]:
        assert len(ref["sha256"]) == 64, "ref identity is not a digest"
        assert "/" not in ref.get("path", ""), "a ref carries a path"
    assert {r["name"] for r in out["pkt"]["refs"]} == {"context", "brief"}


def t_bundle_moves_roots_with_same_digests():
    d = tempfile.mkdtemp()
    a, b = os.path.join(d, "rootA"), os.path.join(d, "rootB")
    out = run_js(MATERIALIZE, a)
    shutil.move(a, b)                       # the whole store relocates
    check = run_js(VERIFY, b, json.dumps(out["pkt"]))
    assert check == {"ok": True}, f"the moved store did not verify: {check}"


def t_missing_blob_blocks_start():
    d = tempfile.mkdtemp()
    root = os.path.join(d, "rootA")
    out = run_js(MATERIALIZE, root)
    ctx_sha = next(r["sha256"] for r in out["pkt"]["refs"] if r["name"] == "context")
    os.unlink(os.path.join(root, "blobs", ctx_sha))
    check = run_js(VERIFY, root, json.dumps(out["pkt"]))
    assert check["ok"] is False and check["missing"] == ["context"], \
        f"a missing blob did not block: {check}"


def t_tampered_blob_is_corrupt():
    d = tempfile.mkdtemp()
    root = os.path.join(d, "rootA")
    out = run_js(MATERIALIZE, root)
    ctx_sha = next(r["sha256"] for r in out["pkt"]["refs"] if r["name"] == "context")
    with open(os.path.join(root, "blobs", ctx_sha), "w") as fh:
        fh.write("someone else's pack")
    check = run_js(VERIFY, root, json.dumps(out["pkt"]))
    assert check["ok"] is False and check["corrupt"] == ["context"], \
        f"a tampered blob passed: {check}"


def t_session_bundle_wires_and_blocks():
    with open(SB, encoding="utf-8") as fh:
        s = fh.read()
    assert "materialize(" in s and "verify(packetRoot, packet)" in s, \
        "sessionBundle does not materialize the packet"
    assert "execution packet does not verify" in s
    assert "startsWith('execution packet does not verify')) throw e" in s, \
        "a failed verify would be swallowed by the compile-failure catch"


def main():
    case("identity is a digest, never a path", t_identity_is_digest_not_path)
    case("the bundle moves to another root with the same digests",
         t_bundle_moves_roots_with_same_digests)
    case("a missing blob blocks the start", t_missing_blob_blocks_start)
    case("a tampered blob is caught by re-hashing", t_tampered_blob_is_corrupt)
    case("sessionBundle materializes and a failed verify blocks the launch",
         t_session_bundle_wires_and_blocks)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
