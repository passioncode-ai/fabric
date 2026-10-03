// An in-memory AccessStore that applies the hub's events the way migrations 76/77's projector does (the
// parts the service relies on), so AccessService's rules can be driven without a database. The
// stack-backed truth stays hub-access-db / hub-door-db; this is the fast tier's view of the same rules.
export function memStore({ now = () => Date.now() } = {}) {
  const requests = new Map(), bindings = new Map(), grants = new Map(), connections = new Map()
  const events = []
  let seq = 0
  const at = () => new Date(now()).toISOString()
  const matches = (r, f) => (!f.status || r.status === f.status) && (!f.agentId || r.agent_id === f.agentId) && (!f.callee || r.callee === f.callee) &&
    (!f.liveAt || Date.parse(r.expires_at) > Date.parse(f.liveAt)) && (!f.standingOnly || r.denial_cleared_at === null)
  return {
    events, maps: { requests, bindings, grants, connections },
    reads: 0,
    async request(id) { this.reads++; return requests.get(id) ?? null },
    async requests(f) {
      this.reads++
      return [...requests.values()].filter((r) => matches(r, f)).sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at)).slice(0, 500)
    },
    async countRequests(f) { this.reads++; return [...requests.values()].filter((r) => matches(r, f)).length },
    async binding(id) { return bindings.get(id) ?? null },
    async bindingByVerifier(v) { return [...bindings.values()].find((b) => b.verifier === v) ?? null },
    async bindings() { return [...bindings.values()] },
    async grantsOf(id) { return [...grants.values()].filter((g) => g.binding_id === id) },
    async liveGrants() { return [...grants.values()].filter((g) => g.revoked_at === null) },
    async liveConnection(p) { return [...connections.values()].find((c) => c.product === p && c.removed_at === null) ?? null },
    async append(type, actor, p) {
      seq++; events.push({ seq, type, actor, payload: p })
      const t = at()
      if (type === 'access.requested@1') requests.set(p.id, { id: p.id, agent_id: p.agent_id, callee: p.callee, capabilities: p.capabilities, resources: p.resources, reason: p.reason, registry: p.registry, asked_by_binding: p.binding_id, poll_verifier: p.poll_verifier ?? null, requested_at: t, expires_at: p.expires_at, status: 'pending', decided_at: null, decided_by: null, granted_binding_id: null, credential_claimed_at: null, denial_cleared_at: null })
      else if (type === 'access.decided@1') {
        const r = requests.get(p.request_id); if (!r || r.status !== 'pending') throw new Error('already decided')
        r.status = p.decision; r.decided_at = t
        if (p.decision === 'allowed') {
          r.granted_binding_id = p.binding_id
          if (p.new_binding) bindings.set(p.binding_id, { id: p.binding_id, agent_id: r.agent_id, request_id: r.id, verifier: null, created_at: t, claimed_at: null, revoked_at: null })
          for (const g of p.grants) {
            const held = grants.get(g.id)
            if (held) Object.assign(held, { request_id: r.id, expires_at: g.expires_at, decided_at: t })
            else grants.set(g.id, { id: g.id, binding_id: p.binding_id, request_id: r.id, agent_id: r.agent_id, callee: r.callee, capability: g.capability, resource: g.resource, decided_at: t, expires_at: g.expires_at, revoked_at: null })
          }
        }
      } else if (type === 'access.credential.claimed@1') {
        const b = bindings.get(p.binding_id); if (!b || b.verifier || b.revoked_at) throw new Error('that binding has no unclaimed credential')
        b.verifier = p.verifier; b.claimed_at = t; requests.get(p.request_id).credential_claimed_at = t
      } else if (type === 'access.grant.revoked@1') { const g = grants.get(p.grant_id); if (!g || g.revoked_at) throw new Error('not live'); g.revoked_at = t }
      else if (type === 'access.binding.revoked@1') { const b = bindings.get(p.binding_id); b.revoked_at = t; for (const g of grants.values()) if (g.binding_id === b.id && !g.revoked_at) g.revoked_at = t }
      else if (type === 'access.denial.cleared@1') { const r = requests.get(p.request_id); r.denial_cleared_at = t }
      else if (type === 'product.connected@1') { for (const c of connections.values()) if (c.product === p.product && !c.removed_at) c.removed_at = t; connections.set(p.id, { ...p, connected_at: t, removed_at: null }) }
      else if (type === 'product.disconnected@1') { const c = connections.get(p.id); if (!c || c.removed_at) throw new Error('not live'); c.removed_at = t }
      return seq
    }
  }
}
export const fakeRegistry = (keys) => ({ refresh() {}, resolve(id) { return keys.includes(id) ? { ok: true, entry: { key: id, kind: 'provider', name: id, installedBy: 'example-installer', repository: null, summary: null } } : { ok: false, reason: `${id} is not registered on this machine` } } })
