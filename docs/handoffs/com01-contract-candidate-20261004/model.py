"""COM candidate executable reference model. No I/O, DB, provider or credentials."""
from copy import deepcopy
import hashlib
import json

# #region com01-model — docs: docs/handoffs/com01-contract-candidate-20261004/contract.md#fences-and-state
class Refusal(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Refusal(code)


def canonical(value):
    """Restricted JSON: integers only, no lone surrogate, no Unicode normalization."""
    def walk(v, depth=0):
        require(depth <= 12, 'invalid_arguments')
        require(type(v) in (dict, list, str, int, bool, type(None)), 'invalid_arguments')
        if isinstance(v, str):
            try:
                v.encode('utf-8')
            except UnicodeEncodeError:
                raise Refusal('invalid_arguments')
        elif type(v) == int:
            require(abs(v) <= 9007199254740991, 'invalid_arguments')
        elif isinstance(v, dict):
            require(all(isinstance(k, str) and k.isascii() for k in v), 'invalid_arguments')
            for k, x in v.items():
                walk(k, depth + 1)
                walk(x, depth + 1)
        elif isinstance(v, list):
            for x in v:
                walk(x, depth + 1)
    walk(value)
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def digest(op, body):
    return hashlib.sha256(b'fabric-project-comms/0.1\x00' + op.encode('ascii') + b'\x00' + canonical(body)).hexdigest()


class Model:
    """Trusted fixture context supplies identity; request body never authorizes identity."""
    def __init__(self, mutant=None):
        self.mutant = mutant
        self.now = 0
        self.epoch = 1
        self.floor = 0
        self.capacity = 2
        self.receipts = {}
        self.request = None
        self.slot = {'principal': 'claude', 'generation': 1, 'authority': 1}
        self.current = {'claude': 1, 'codex': 1, 'reader': 1}
        self.participants = ('A', 'B')
        self.project = {'claude': 'B', 'codex': 'B', 'reader': 'A', 'outsider': 'C'}
        self.restore_epoch = 1
        self.events = []
        self.effects = 0
        self.next_attempt = 0
        self.cursor = None
        self.read_mark = 0

    def authorize(self, principal, revision=1):
        require(self.current.get(principal) == revision, 'authority_changed')
        require(self.project.get(principal) in self.participants, 'not_authorized')

    def mutate(self, principal, generation, attempt, authority=1):
        self.authorize(principal, authority)
        require(self.slot['principal'] == principal and self.slot['authority'] == authority, 'fenced')
        if self.mutant != 'generation':
            require(generation == self.slot['generation'], 'fenced')
        require(self.request is not None, 'not_available')
        if self.mutant != 'attempt':
            require(attempt == self.request['attempt'], 'fenced')
        if self.mutant != 'expiry':
            require(self.now < self.request['lease'], 'lease_expired')

    def apply(self, action, **a):
        principal = a.get('principal', 'claude')
        if action == 'advance':
            self.now += a['seconds']
            return self.now
        if action == 'submit':
            self.authorize(principal)
            epoch, key, body = a.get('epoch', 1), a.get('key', 'k1'), a.get('body', {'text': 'hello'})
            require(not any(k in body for k in ('estate_id', 'principal_id', 'sender_project_id', 'session_id')), 'invalid_arguments')
            if self.mutant != 'epoch':
                require(epoch > self.floor and epoch == self.epoch, 'idempotency_window_expired')
            h = digest('submit', body)
            if (epoch, key) in self.receipts:
                require(self.receipts[(epoch, key)] == h, 'idempotency_conflict')
                return 'replayed'
            require(len(self.receipts) < self.capacity, 'capacity_exceeded')
            require(self.request is None, 'capacity_exceeded')
            self.receipts[(epoch, key)] = h
            self.request = {'state': 'queued', 'effect': 'not_started', 'attempt': None, 'lease': 0, 'digest': h}
            self.events.append('stored')
            return 'stored'
        if action == 'replace':
            require(a.get('manage', False), 'not_authorized')
            require(a['expected'] == self.slot['generation'], 'revision_conflict')
            self.authorize(a['next'])
            self.slot = {'principal': a['next'], 'generation': self.slot['generation'] + 1, 'authority': self.current[a['next']]}
            # A resumed same principal with the wrong old generation is still fenced.
            if self.request and self.request['state'] == 'claimed':
                self.request['state'] = 'queued'
                self.request['attempt'] = None
            return self.slot['generation']
        if action == 'claim':
            self.authorize(principal)
            require(principal == self.slot['principal'], 'fenced')
            require(self.request is not None, 'not_available')
            require(self.request['state'] == 'queued' or (self.request['state'] == 'claimed' and self.now >= self.request['lease']), 'reconcile_required')
            self.next_attempt += 1
            self.request.update(state='claimed', attempt=self.next_attempt, lease=self.now + 60)
            return self.next_attempt
        if action in ('accept', 'renew', 'reply', 'begin', 'complete'):
            self.mutate(principal, a.get('generation', 1), a.get('attempt', 1), a.get('authority', 1))
            r = self.request
            require(a.get('digest', r['digest']) == r['digest'], 'digest_conflict')
            if action == 'accept':
                require(r['state'] == 'claimed', 'invalid_transition')
                r['state'] = 'accepted'
            elif action == 'renew':
                r['lease'] = self.now + 60
            elif action == 'reply':
                self.events.append('reply')
            elif action == 'begin':
                require(r['state'] == 'accepted', 'invalid_transition')
                require(r['effect'] == 'not_started', 'reconcile_required')
                require(a.get('effect_permission', False), 'not_authorized')
                r.update(effect='started', state='in_progress')
                self.effects += 1
            else:
                require(r['state'] == 'in_progress' and r['effect'] == 'started', 'invalid_transition')
                require(a.get('observed', False), 'observation_required')
                r.update(effect='succeeded_observed', state='completed')
            return r['state']
        if action == 'lost_result':
            require(self.request['effect'] == 'started', 'invalid_transition')
            self.request.update(effect='unknown', state='outcome_unknown')
            return 'outcome_unknown'
        if action == 'cancel':
            self.authorize(principal)
            if self.request['effect'] in ('started', 'unknown') and self.mutant != 'unknown':
                self.request.update(effect='unknown', state='outcome_unknown')
            else:
                self.request['state'] = 'cancelled'
            return self.request['state']
        if action == 'revoke':
            self.current[principal] = self.current.get(principal, 1) + 1
            return 'revoked'
        if action == 'cursor':
            self.authorize(principal)
            self.cursor = (principal, self.current[principal], self.restore_epoch, a.get('filter', 'all'), len(self.events))
            return 'issued'
        if action == 'page':
            self.authorize(principal, a.get('authority', 1))
            if self.mutant != 'cursor':
                require(self.cursor[:4] == (principal, self.current[principal], self.restore_epoch, a.get('filter', 'all')), 'cursor_reset_required')
            return self.events[:self.cursor[4]]
        if action == 'read_ack':
            self.authorize(principal)
            require(0 <= a['ordinal'] <= len(self.events), 'not_authorized')
            self.read_mark = max(self.read_mark, a['ordinal'])
            return self.read_mark
        if action == 'change_participants':
            require(self.mutant == 'participants', 'immutable_participants')
            self.participants = tuple(a['participants'])
            return 'changed'
        if action == 'retire':
            self.floor = self.epoch
            self.epoch += 1
            # Unknown facts cannot be compacted, even though namespace admission is closed.
            if self.request and self.request['effect'] != 'unknown':
                self.receipts.clear()
                self.request = None
            return self.floor
        if action == 'restart':
            return deepcopy(self.request)
        if action == 'restore':
            self.restore_epoch += 1
            self.floor = self.epoch
            self.epoch += 1
            self.slot['generation'] += 1
            if self.mutant != 'restore':
                self.current = {}
                self.slot['principal'] = None
                if self.request and self.request['effect'] == 'started':
                    self.request.update(effect='unknown', state='outcome_unknown')
            return 'history_only'
        raise Refusal('unsupported_operation')
# #endregion com01-model
