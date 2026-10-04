#!/usr/bin/env python3
"""Research artifact check, deliberately not a production COM behavior test."""
# #region lifecycle-packet-check — docs: docs/reports/2026-10-04-local-agent-lifecycle/README.md#verification-and-integration-limits
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate(packets, vectors, static):
    assert packets['shared_contract']['not_existing_api'] is True
    assert packets['shared_contract']['provider_public_example'] == 'example-agent'
    assert len(packets['basis']) == 40
    entries = packets['packets']
    assert len(entries) == 7
    assert len({p['packet_key'] for p in entries}) == 7
    assert all('status' not in p and 'ready' not in p for p in entries)
    cases = {c['id'] for c in vectors['cases']}
    assert len(cases) == len(vectors['cases']) == 33
    assert vectors['execution'].startswith('NOT_RUN')
    covered = set()
    for packet in entries:
        assert packet['nature'] == 'future-proposal-not-dispatch-authority'
        assert packet['dependencies'] and packet['definition_of_done'] and packet['stop_rollback']
        assert len(packet['implementation_owner']['revision']) == 40
        assert packets['basis'] in packet['canonical_task']['identity']
        ids = set(packet['watched_negative_cases'])
        assert ids <= cases
        covered |= ids
        repo = packet['implementation_owner']['repository']
        issue = packet['implementation_owner']['issue']
        if repo.endswith('fabric-agent-adapter'):
            assert issue == 'https://github.com/passioncode-ai/fabric-agent-adapter/issues/31'
        if repo.endswith('fabric-switchboard'):
            assert issue == 'https://github.com/passioncode-ai/fabric-switchboard/issues/36'
    assert covered == cases
    assert static['runtime'].startswith('NOT_RUN')
    assert static['versions']['codex'] == 'codex-cli 0.160.0'
    assert static['versions']['claude'].startswith('2.1.289 ')
    assert set(f'thread/queue/{x}' for x in ['add', 'list', 'update', 'delete', 'reorder', 'start']) <= set(static['methods'])
    assert {'hooks/list', 'turn/start', 'thread/read', 'mcpServer/tool/call'} <= set(static['methods'])
    assert set(static['schemas']['v2/ThreadQueueAddParams.json']['required']) == {'threadId', 'clientUserMessageId', 'input'}
    assert static['schemas']['v2/ThreadQueueStartParams.json']['required'] == ['threadId']
    assert static['schemas']['v2/TurnStartParams.json']['required'] == ['input', 'threadId']
    assert static['schemas']['v2/HooksListResponse.json']['required'] == ['data']
    assert set(static['schemas']['v2/McpServerToolCallParams.json']['required']) == {'server', 'threadId', 'tool'}


def main():
    packets = json.loads((ROOT / 'packets/packets.json').read_text())
    vectors = json.loads((ROOT / 'packets/negative-cases.json').read_text())
    static = json.loads((ROOT / 'raw/local-probes.json').read_text())
    validate(packets, vectors, static)
    mutants = []
    p = copy.deepcopy(packets); p['packets'][0]['status'] = 'ready'; mutants.append((p, vectors, static))
    p = copy.deepcopy(packets); p['packets'][0]['implementation_owner']['issue'] = 'https://example.invalid/other'; mutants.append((p, vectors, static))
    v = copy.deepcopy(vectors); v['cases'].pop(); mutants.append((packets, v, static))
    s = copy.deepcopy(static); s['runtime'] = 'accepted'; mutants.append((packets, vectors, s))
    s = copy.deepcopy(static); s['methods'].remove('thread/queue/add'); mutants.append((packets, vectors, s))
    for triple in mutants:
        try:
            validate(*triple)
        except AssertionError:
            pass
        else:
            raise AssertionError('Artifact claim/scope corruption was accepted')
    print(json.dumps({'artifact_validation': 'PASS', 'packets': 7,
                      'designed_acceptance_vectors': 33,
                      'rejected_artifact_corruptions': 5,
                      'production_negative_execution': 'NOT_RUN'}, indent=2))


if __name__ == '__main__':
    main()
# #endregion lifecycle-packet-check
