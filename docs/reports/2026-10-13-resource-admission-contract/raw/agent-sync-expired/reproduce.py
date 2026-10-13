#!/usr/bin/env python3
"""Portable source regression; no real Git/config/network calls.
Run: python3 reproduce.py /path/to/agent_sync.py [--sha SHA256] [--expect defect|fixed]
Exit 0 means the explicitly selected expectation was observed, NOT that leases are safe.
"""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--sha', default='455d99c97894e4b5033399fac3fc5c638375dffae531982f22a8bd6899e56302')
parser.add_argument('--expect', choices=['defect', 'fixed'], default='defect')
args = parser.parse_args()
source = args.source.resolve()
digest = hashlib.sha256(source.read_bytes()).hexdigest()
if digest != args.sha:
    raise SystemExit('Source digest mismatch; no code imported')
sys.dont_write_bytecode = True
root = Path(tempfile.mkdtemp(prefix='agent-sync-expired-state-', dir='/tmp')).resolve()
original_cwd = Path.cwd()
safety = {'real_network_or_process_attempts': 0, 'outside_write_attempts': 0}

def inside(path):
    if isinstance(path, int):
        return True
    value = Path(os.fsdecode(path))
    if not value.is_absolute():
        value = Path.cwd() / value
    return value.resolve().is_relative_to(root)

def audit(event, values):
    if event in ('subprocess.Popen', 'os.system', 'os.posix_spawn', 'os.posix_spawnp', 'socket.connect', 'socket.getaddrinfo', 'socket.bind', 'urllib.Request'):
        safety['real_network_or_process_attempts'] += 1
        raise RuntimeError('real process/network operation forbidden')
    paths = []
    if event == 'open':
        name, mode, flags = values
        if (isinstance(mode, str) and any(c in mode for c in 'wax+')) or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
            paths = [name]
    elif event in ('os.mkdir', 'os.remove', 'os.rmdir', 'os.chmod', 'os.truncate'):
        paths = [values[0]]
    elif event in ('os.rename', 'os.link', 'os.symlink'):
        paths = list(values[:2])
    if any(not inside(path) for path in paths):
        safety['outside_write_attempts'] += 1
        raise RuntimeError('write outside owned temporary state forbidden')

sys.addaudithook(audit)
try:
    os.chdir(root)
    os.environ.clear()
    os.environ.update({'HOME': str(root), 'PATH': '', 'PYTHONDONTWRITEBYTECODE': '1'})
    spec = importlib.util.spec_from_file_location('isolated_agent_sync_source', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    NOW = 2_000_000_000
    iso = lambda epoch: module.datetime.fromtimestamp(epoch, module.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    module.time = SimpleNamespace(time=lambda: NOW)
    module.now_iso = lambda: iso(NOW)
    module.repo_name = lambda: 'fixture-repository'
    module.head_sha = lambda: '0' * 40
    module.platform = SimpleNamespace(node=lambda: 'fixture-host')
    reports = []
    for label, age in [('expired-own-resource', 120), ('live-own-resource', 10)]:
        local_root = root / label
        leases = local_root / module.STATE_DIR / 'leases'
        leases.mkdir(parents=True)
        sync = module.Sync.__new__(module.Sync)  # never reads actual project config/env
        sync.root = local_root
        sync.cfg = {'leaseBackend': 'git', 'leaseRemote': 'fixture-remote', 'guardedFiles': ['docs/plan.md'], 'mode': 'gated', 'renewIntervalSeconds': 15}
        sync.rid = 'fixture-run'
        sync.ttl = 60
        sync._lease_gen = {}
        sync._holders = {}
        sync.adapter = SimpleNamespace(preflight=lambda: '', is_lease_authority=False, log_append=lambda *_: None)
        sync.write_claim = lambda *_: []
        sync.log_id = lambda *_: 'fixture-log'
        sync._lock_names_other_key = lambda *_: None
        sync._local_lock = lambda key: leases / (module.lease_name(key) + '.lock')
        sync._require_git_remote = lambda *_: 'fixture-remote'
        path = local_root / 'docs/plan.md'
        key = sync.resource_key(str(path))
        ref = 'refs/agent-sync/leases/' + module.lease_name(key)
        body = {'key': key, 'run': sync.rid, 'ts': iso(NOW - age), 'ttl': 60, 'repo': 'fixture-repository', 'host': 'fixture-host', 'since': iso(NOW - age)}
        remote = {'sha': '1' * 40, 'body': body}
        commits, operations = {}, []
        sync._git_read_lease = lambda _key, **_options: (remote['sha'], dict(remote['body']), ref)
        def fake_git(*words, **_kwargs):
            operations.append(['git-helper', *words])
            if words == ('hash-object', '-t', 'tree', os.devnull):
                return '2' * 40
            raise AssertionError('unexpected Git helper call')
        def fake_run(words, **options):
            operations.append(list(words))
            if words[:1] != ['git']:
                raise AssertionError('unexpected subprocess request')
            if 'commit-tree' in words:
                payload = json.loads(options['input'])
                sha = hashlib.sha1(options['input'].encode()).hexdigest()
                commits[sha] = payload
                return subprocess.CompletedProcess(words, 0, sha + '\n', '')
            if 'push' in words:
                expected = '--force-with-lease=' + ref + ':' + remote['sha']
                if expected not in words:
                    return subprocess.CompletedProcess(words, 1, '', 'fixture CAS mismatch')
                sha, target = words[-1].split(':', 1)
                assert target == ref and sha in commits
                remote.update(sha=sha, body=commits[sha])
                return subprocess.CompletedProcess(words, 0, '', '')
            raise AssertionError('unexpected Git command')
        module.git = fake_git
        module.subprocess = SimpleNamespace(run=fake_run, SubprocessError=subprocess.SubprocessError)
        sync._note_local('TASK-fixture', json.dumps({'key': 'TASK-fixture', 'run': sync.rid, 'ts': iso(NOW), 'ttl': 60}))
        sync._note_local(key, json.dumps(body))
        if label.startswith('expired'):
            allowed, reason = sync.guard(str(path))  # actual guard -> acquire -> _git_acquire
        else:
            allowed, _holder = sync.acquire(key)  # actual public acquire, live own lease
            reason = 'explicit live-own acquire'
        note = json.loads(sync._local_lock(key).read_text())
        marker_path = sync._renew_marker(key)
        marker = marker_path.read_text().strip() if marker_path.exists() else ''
        cas_count = sum('push' in operation for operation in operations)
        result = {
            'case': label, 'reported_success': allowed, 'message': reason,
            'simulated_cas_pushes': cas_count, 'remote_ref_changed': remote['sha'] != '1' * 40,
            'remote_remaining_seconds': module.parse_iso(remote['body']['ts']) + 60 - NOW,
            'local_remaining_seconds': module.parse_iso(note['ts']) + 60 - NOW,
            'resource_in_held': key in sync.held(), 'main_task_in_held': 'TASK-fixture' in sync.held(),
            'renew_marker_set_to_now': module.parse_iso(marker) == NOW,
        }
        if label.startswith('expired'):
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                result['explicit_renew_succeeded'] = sync.renew(key)
            result['renew_reports_expired'] = 'expired' in stderr.getvalue()
            if args.expect == 'defect':
                assert allowed is True and cas_count == 0 and result['remote_remaining_seconds'] == -60
                assert result['local_remaining_seconds'] == -60 and not result['resource_in_held']
                assert result['main_task_in_held'] and result['renew_marker_set_to_now']
                assert result['explicit_renew_succeeded'] is False and result['renew_reports_expired']
            else:
                assert allowed is False or (cas_count >= 1 and result['remote_remaining_seconds'] > 0 and result['resource_in_held'])
        reports.append(result)
    assert not any(safety.values())
    print(json.dumps({'status': 'DEFECT_REPRODUCED' if args.expect == 'defect' else 'FIX_EXPECTATION_MET',
        'source_sha256': digest, 'source_version': module.VERSION, 'execution': 'actual source methods with simulated Git authority and owned temporary notes',
        'cases': reports, 'safety': safety, 'real_claims_created': 0, 'runtime_or_hosted_CAS_acceptance': 'NOT_RUN'}, indent=2))
finally:
    os.chdir(original_cwd)
    for owned in sorted(root.rglob('*'), key=lambda p: len(p.parts), reverse=True):
        if owned.is_dir(): owned.rmdir()
        else: owned.unlink()
    root.rmdir()
