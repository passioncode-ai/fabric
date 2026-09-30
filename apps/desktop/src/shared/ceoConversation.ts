/** CW-N1a storage contract. Selection is not compiled-source coverage. No runtime
 * dispatch exists here. Keep canonical field order in migration64 in lockstep. */
import { prepareOriginalInstruction } from './commandIngress.ts'

export const CEO_LIMITS = Object.freeze({ bodyBytes: 32768, wireBytes: 65536, pageSize: 50, maxRevision: Number.MAX_SAFE_INTEGER })
export const CEO_PREPARATION = 'har06-ceo-v1' as const
export interface CeoContext {
  schema: 'CeoContext@1'; mode: 'none' | 'one'; selection_revision: number
  project_id: string | null; project_revision: number | null
  /** Estate journal read boundary, never source completeness. */
  estate_seq: number
}
export interface CeoSend {
  schema: 'CeoSend@1'; operation_id: string; conversation_id: string; message_id: string
  expected_revision: number; subject_revision: number; input_channel: 'text'
  text: string; preparation_version: typeof CEO_PREPARATION; context: CeoContext
}
export type CeoPreparation = { ok: true; value: CeoSend } | { ok: false; reason_code: 'invalid_input' | 'too_large' | 'unsupported_context' }
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)
const integer = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const utf8 = (x: string): number => new TextEncoder().encode(x).length
const nonblank = (x: string): boolean => /[^\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(x)
const unicode = (x: string): boolean => !/[\u0000\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(x) && !x.includes('\0')
function record(x: unknown, keys: string[]): Record<string, unknown> | null {
  if (!x || typeof x !== 'object' || (Object.getPrototypeOf(x) !== Object.prototype && Object.getPrototypeOf(x) !== null)) return null
  const ds = Object.getOwnPropertyDescriptors(x)
  if (Reflect.ownKeys(ds).length !== keys.length || keys.some(k => !Object.hasOwn(ds,k) || !('value' in ds[k]) || !ds[k].enumerable)) return null
  return Object.fromEntries(keys.map(k => [k, ds[k].value]))
}
const sendKeys = ['schema','operation_id','conversation_id','message_id','expected_revision','subject_revision','input_channel','text','preparation_version','context']
const contextKeys = ['schema','mode','selection_revision','project_id','project_revision','estate_seq']
/** Migration 64's `ceo_send_error`, in JS: the envelope's shape and bounds, with its text taken
 * exactly as it is. This is what a HISTORICAL envelope — one already accepted, or imported by
 * migration 66 — is held to. It never runs today's sanitizer (ADR-0079 §5, CO-172). */
export function historicalCeoSend(input: unknown): CeoPreparation {
  const p=record(input,sendKeys)
  if (!p) return {ok:false,reason_code:'invalid_input'}
  const c=record(p.context,contextKeys)
  if (!c || p.schema!=='CeoSend@1' || p.preparation_version!==CEO_PREPARATION || p.input_channel!=='text' ||
    !uuid(p.operation_id) || !uuid(p.message_id) || !uuid(p.conversation_id) || !integer(p.expected_revision) || !integer(p.subject_revision) ||
    typeof p.text!=='string' || !unicode(p.text) || !nonblank(p.text) || c.schema!=='CeoContext@1' ||
    !integer(c.selection_revision) || !integer(c.estate_seq)) return {ok:false,reason_code:'invalid_input'}
  if (c.mode!=='none' && c.mode!=='one') return {ok:false,reason_code:'unsupported_context'}
  if (c.mode==='none' ? c.project_id!==null || c.project_revision!==null : !uuid(c.project_id) || !integer(c.project_revision))
    return {ok:false,reason_code:'invalid_input'}
  const plain={...p,context:c}
  if (utf8(p.text)>CEO_LIMITS.bodyBytes || utf8(JSON.stringify(plain))>CEO_LIMITS.wireBytes) return {ok:false,reason_code:'too_large'}
  return {ok:true,value:plain as unknown as CeoSend}
}
/** New input: the historical rules, then today's preparation of the text. Requires a plain
 * already-decoded JSON envelope; accessors/toJSON never run. */
export function prepareCeoSend(input: unknown): CeoPreparation {
  const historical=historicalCeoSend(input)
  if (!historical.ok) return historical
  const plain=historical.value
  const prepared=prepareOriginalInstruction(plain.text)
  if (prepared.state!=='prepared') return {ok:false,reason_code:'invalid_input'}
  const value={...plain,text:prepared.value} as unknown as CeoSend
  if (utf8(value.text)>CEO_LIMITS.bodyBytes || utf8(JSON.stringify(value))>CEO_LIMITS.wireBytes) return {ok:false,reason_code:'too_large'}
  return {ok:true,value}
}
/** Canonical strings have UTF-8 byte lengths; null is a distinct -1: token.
 * This is a protocol string, NOT JSON canonicalization. Hash its UTF-8 bytes.
 * Reject unprepared input instead of silently deriving a different fingerprint. */
export function canonicalCeoSend(estateId: string, personId: string, p: CeoSend): string {
  const result=prepareCeoSend(p)
  if (!result.ok || result.value.text!==p.text) throw new Error('unprepared_input')
  return historicalCeoSendCanonical(estateId,personId,result.value)
}
/** Migration 64's `ceo_send_canonical(estate, person, envelope)`, byte for byte, for an envelope
 * that already passed `historicalCeoSend`. The one framing both paths share. */
export function historicalCeoSendCanonical(estateId: string, personId: string, p: CeoSend): string {
  if (!uuid(estateId) || !uuid(personId)) throw new Error('invalid_identity')
  const c=p.context
  const fields: (string|number|null)[]=['CeoSend@1',estateId,personId,p.operation_id,p.conversation_id,p.message_id,
    p.expected_revision,p.subject_revision,'text',p.text,CEO_PREPARATION,'CeoContext@1',c.mode,c.selection_revision,c.project_id,c.project_revision,c.estate_seq]
  return fields.map(v=>v===null?'-1:':`${utf8(String(v))}:${String(v)}`).join('')
}
