/**
 * The execution root of an owned loopback backend (first-slice plan B0, proposal T1, ADR-0081).
 *
 * Three separate identities: the EXECUTION ROOT is the Fabric-started backend process and its
 * epoch; the CONTROLLER is Fabric's structured connection to it (`controller:*`, the only one a
 * provider binding may name); a VIEW (`view:*`) is the operator's native TUI, which observes.
 *
 * What the receipts may and may not do, as a fold:
 * - a view attaching or detaching changes the set of views and nothing else — closing the TUI is
 *   never a Stop, and never ends the Run;
 * - a receipt for an older epoch is refused, so a stale view cannot signal a newer backend;
 * - Stop is REQUESTED, and settled only by the backend's own exit receipt for its epoch;
 * - a lost backend turns input off everywhere and claims no stop; only an exit receipt settles it.
 */
export type ExecutionReceipt =
  | { kind: 'view_attached' | 'view_detached'; viewId: string; epoch: string; evidenceRef: string }
  | { kind: 'stop_requested'; commandId: string; evidenceRef: string }
  | { kind: 'backend_lost'; epoch: string; evidenceRef: string }
  | { kind: 'backend_exit'; epoch: string; exitCode: number | null; evidenceRef: string }
export interface ExecutionRootState {
  readonly processRef: string
  readonly epoch: string
  readonly status: 'running' | 'stopping' | 'backend_lost' | 'exited'
  readonly inputAllowed: boolean
  readonly views: readonly string[]
  readonly stop: { commandId: string; evidenceRef: string } | null
  readonly exit: { exitCode: number | null; evidenceRef: string } | null
}
export type ExecutionFold = { accepted: boolean; reasonCode: string; state: ExecutionRootState }

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const exact = (v: Record<string, unknown>, ks: string[]) => Object.keys(v).length === ks.length && ks.every(k => Object.hasOwn(v, k))
const id = (v: unknown): v is string => typeof v === 'string' && v.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v)
const evidence = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v)
const processRef = (v: unknown): v is string => typeof v === 'string' && /^process:[a-f0-9]{16,64}$/.test(v)
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) } return v }

export function createExecutionRoot(input: { processRef: string; epoch: string }): ExecutionRootState {
  if (!plain(input) || !exact(input, ['processRef', 'epoch']) || !processRef(input.processRef) || !id(input.epoch)) throw new Error('invalid_execution_root')
  return freeze({ processRef: input.processRef, epoch: input.epoch, status: 'running', inputAllowed: true, views: [], stop: null, exit: null })
}

function receipt(v: unknown): ExecutionReceipt | null {
  if (!plain(v) || !evidence(v.evidenceRef)) return null
  switch (v.kind) {
    case 'view_attached': case 'view_detached':
      return exact(v, ['kind', 'viewId', 'epoch', 'evidenceRef']) && typeof v.viewId === 'string' && v.viewId.startsWith('view:') && id(v.viewId) && id(v.epoch) ? v as ExecutionReceipt : null
    case 'stop_requested': return exact(v, ['kind', 'commandId', 'evidenceRef']) && id(v.commandId) ? v as ExecutionReceipt : null
    case 'backend_lost': return exact(v, ['kind', 'epoch', 'evidenceRef']) && id(v.epoch) ? v as ExecutionReceipt : null
    case 'backend_exit': return exact(v, ['kind', 'epoch', 'exitCode', 'evidenceRef']) && id(v.epoch) && (v.exitCode === null || Number.isSafeInteger(v.exitCode)) ? v as ExecutionReceipt : null
    default: return null
  }
}

export function foldExecutionRoot(state: ExecutionRootState, input: unknown): ExecutionFold {
  const no = (reasonCode: string): ExecutionFold => ({ accepted: false, reasonCode, state })
  const yes = (next: Partial<ExecutionRootState>): ExecutionFold => ({ accepted: true, reasonCode: 'accepted', state: freeze({ ...state, ...next }) })
  const r = receipt(input)
  if (!r) return no('invalid_receipt')
  if ('epoch' in r && r.epoch !== state.epoch) return no('stale_epoch')
  if (state.status === 'exited') return no('execution_ended')
  switch (r.kind) {
    case 'view_attached': return yes({ views: state.views.includes(r.viewId) ? state.views : [...state.views, r.viewId] })
    case 'view_detached': return yes({ views: state.views.filter(v => v !== r.viewId) })
    case 'stop_requested': return state.stop ? no('stop_already_requested') : yes({ status: state.status === 'backend_lost' ? 'backend_lost' : 'stopping', inputAllowed: false, stop: { commandId: r.commandId, evidenceRef: r.evidenceRef } })
    case 'backend_lost': return yes({ status: 'backend_lost', inputAllowed: false })
    case 'backend_exit': return yes({ status: 'exited', inputAllowed: false, views: [], exit: { exitCode: r.exitCode, evidenceRef: r.evidenceRef } })
  }
}
