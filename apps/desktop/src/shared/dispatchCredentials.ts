// #region dispatch-credentials — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#34-the-packet
/**
 * The keys a board run may be handed, by name (CO-619; board request 8eb58906, 2026-11-21).
 * Observatory hands a dispatched run a key only for a slot its packet's FIRST revision names in `credentials`
 * (`[{project, env, name, purpose}]`, names only; its `dispatch_packet.py`, OBS-323, OBS-343), and only from the project
 * the packet's `fabric-project` resolves to. Until 0.3.21 the dispatcher named none, so no board run could be handed a
 * key. The project the request is addressed to declares which of its own slots a capability's runs need, in its primary
 * folder's `.fabric/dispatch-credentials.json`:
 *
 *     {"kind": "dispatch-credentials/1",
 *      "capabilities": {"access.client-key": [{"env": "prod", "name": "SERVICE_KEY", "purpose": "..."}]}}
 *
 * The file names no project: the slots are always the target's own, which Fabric fills in as the project Observatory
 * resolves, so a declaration cannot reach another project's keys (Observatory would refuse them too, `project-mismatch`).
 * A file that is absent, unreadable or malformed names nothing, and the run starts as before without keys.
 */

export const DECLARATION_FILE = '.fabric/dispatch-credentials.json'
export const DECLARATION_KIND = 'dispatch-credentials/1'
/** A declaration larger than this is not read: it is names, not data. */
export const DECLARATION_MAX_BYTES = 64 * 1024
/** At most this many slots for one capability. */
export const SLOTS_MAX = 16

const CAPABILITY = /^[a-z][a-z0-9._-]{1,127}$/
const ENV = /^[a-z][a-z0-9_-]{0,31}$/
const NAME = /^[A-Z][A-Z0-9_]{0,127}$/

export interface DeclaredSlot { env: string; name: string; purpose: string }

export type DeclarationRead = { ok: true; slots: DeclaredSlot[] } | { ok: false; why: string }

/** The slots `text` declares for `capability`; none when it declares none for it. A malformed file is `ok: false`. */
export function declaredSlots(text: string, capability: string): DeclarationRead {
  if (text.length > DECLARATION_MAX_BYTES) return { ok: false, why: 'too-large' }
  let value: unknown
  try { value = JSON.parse(text) } catch { return { ok: false, why: 'not-json' } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, why: 'not-an-object' }
  const v = value as { kind?: unknown; capabilities?: unknown }
  if (v.kind !== DECLARATION_KIND) return { ok: false, why: 'kind' }
  const caps = v.capabilities
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) return { ok: false, why: 'capabilities' }
  for (const key of Object.keys(caps)) if (!CAPABILITY.test(key)) return { ok: false, why: 'capability-name' }
  if (!CAPABILITY.test(capability) || !Object.hasOwn(caps, capability)) return { ok: true, slots: [] }
  const list = (caps as Record<string, unknown>)[capability]
  if (!Array.isArray(list) || list.length > SLOTS_MAX) return { ok: false, why: 'slots' }
  const slots: DeclaredSlot[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, why: 'slot' }
    const keys = Object.keys(item)
    // `project` is refused on purpose: the slot is always the target project's own.
    if (keys.some((k) => k !== 'env' && k !== 'name' && k !== 'purpose')) return { ok: false, why: 'slot-field' }
    const { env, name, purpose } = item as Record<string, unknown>
    if (typeof env !== 'string' || !ENV.test(env)) return { ok: false, why: 'slot-env' }
    if (typeof name !== 'string' || !NAME.test(name)) return { ok: false, why: 'slot-name' }
    if (typeof purpose !== 'string' || purpose.trim().length === 0 || purpose.length > 200) return { ok: false, why: 'slot-purpose' }
    const id = `${env}/${name}`
    if (seen.has(id)) continue
    seen.add(id)
    slots.push({ env, name, purpose: purpose.trim() })
  }
  return { ok: true, slots }
}

/** The packet's `credentials` block: the declared slots of `project` (the Observatory id the target resolves to). */
export function packetCredentials(project: string, slots: readonly DeclaredSlot[]): Array<{ project: string; env: string; name: string; purpose: string }> {
  return slots.map((s) => ({ project, env: s.env, name: s.name, purpose: s.purpose }))
}
// #endregion dispatch-credentials
