// #region hub-call-authority — docs: docs/evidence/plans/2026-10-26-0313-w4-contract-delta.md#3-every-decision-of-the-delta-as-it-touches-fabric
// The operator's decision (fabric-agent-contract DEC-0121 AP-2, `decision.schema.json`) and mandate (DEC-0125 MD-3,
// `mandate.schema.json`, `source` from DEC-0126) as the hub's `agent.call` carries them (`interop-agent-call.schema.json`
// at 39c8977, CO-434, CO-435). The hub checks their SHAPE only and forwards them unchanged: whether a decision is fresh,
// names the called action, or a mandate covers the call is the callee's to decide (`actionDecision`, `mandateCovers`).
//
// These zod schemas MIRROR the pinned JSON schemas, which the runtime does not ship: `test/hub-call-authority.test.mjs`
// holds each to the pinned schema compiled by the contract's own compiler (ajv 8.20.0 with ajv-formats 3.0.1), case by
// case. Three things a plain zod schema would read differently from that compiler, and why each is spelled out here:
//   - a string's length is counted in code points (ajv's `unicode` default), not in UTF-16 units;
//   - `format: date-time` is ajv-formats' full reading (`t` or a space, `z`, an offset with or without a colon, a real
//     calendar day, a leap second only at 23:59 UTC), neither stricter nor looser;
//   - `uniqueItems` refuses a repeated string.
//
// Every hub origin is a binding credential on the operator's own machine (ADR-0115: loopback only), so every origin
// is T0 or T1 (DL-25): the hub forwards their decision and mandate and never has a T2 origin's to drop (C3.5).

import { z } from 'zod'

const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/
const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i
const leap = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)

/** RFC 3339 date-time exactly as the contract's compiler asserts `format: date-time` (ajv-formats 3.0.1, full mode). */
export function isContractDateTime(s: string): boolean {
  const parts = s.split(/t|\s/i)
  if (parts.length !== 2) return false
  const d = DATE.exec(parts[0])
  if (!d) return false
  const year = +d[1], month = +d[2], day = +d[3]
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && leap(year) ? 29 : DAYS[month]))) return false
  const t = TIME.exec(parts[1])
  if (!t) return false
  const hr = +t[1], min = +t[2], sec = +t[3]
  const sign = t[5] === '-' ? -1 : 1, tzH = +(t[6] || 0), tzM = +(t[7] || 0)
  if (tzH > 23 || tzM > 59 || !t[4]) return false
  if (hr <= 23 && min <= 59 && sec < 60) return true
  const utcMin = min - tzM * sign
  const utcHr = hr - tzH * sign - (utcMin < 0 ? 1 : 0)
  return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61
}

const text = (min: number, max: number) =>
  z.string().refine((s) => { const n = [...s].length; return n >= min && n <= max }, { message: `${min} to ${max} characters` })
const timestamp = z.string().refine(isContractDateTime, { message: 'an RFC 3339 date-time' })
const unique = <T extends z.ZodType<string>>(item: T, min: number, max: number) =>
  z.array(item).min(min).max(max).refine((a) => new Set(a).size === a.length, { message: 'no repeated item' })
/** `interop-common.schema.json#/$defs/requestKey` */
const requestKey = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/)
/** `common.schema.json#/$defs/agentId` */
const agentId = z.string().regex(/^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/)
/** `common.schema.json#/$defs/capabilityName` */
const capabilityName = z.string().regex(/^[a-z][a-z0-9._-]{1,127}$/)
/** `common.schema.json#/$defs/effectClass` */
const effectClass = z.enum(['none', 'draft', 'publish', 'send', 'reply', 'charge', 'delete', 'merge', 'deploy', 'change-policy'])
const placeId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)

/** `mandate.schema.json#/$defs/source` (DEC-0126 OA-2): the project, and the session or the board thread. */
export const operatorSourceSchema = z
  .object({ project: placeId, session: placeId.optional(), thread: placeId.optional() })
  .strict()
  .refine((s) => s.session !== undefined || s.thread !== undefined, { message: 'a session or a thread' })

/** `mandate.schema.json#/$defs/scope` */
const scopeSchema = z
  .object({
    capabilities: unique(capabilityName, 1, 64).optional(),
    actions: unique(requestKey, 1, 64).optional(),
    effects: unique(effectClass, 1, 10),
    perCallMaxUsd: z.number().min(0).max(100000).optional(),
    projects: unique(placeId, 1, 16).optional()
  })
  .strict()

/** `decision.schema.json`: the operator's decision on one relayed action (DEC-0121 AP-2). */
export const decisionSchema = z
  .object({
    by: z.literal('operator'),
    via: z.literal('relayed-instruction'),
    action: requestKey,
    target: text(1, 200).optional(),
    instruction: text(1, 500),
    at: timestamp,
    source: operatorSourceSchema.optional()
  })
  .strict()

/** `mandate.schema.json`: the operator's mandate for one task (DEC-0125 MD-1, MD-2). */
export const mandateSchema = z
  .object({
    kind: z.literal('mandate/1'),
    by: z.literal('operator'),
    task: text(1, 200),
    instruction: text(1, 500),
    at: timestamp,
    source: operatorSourceSchema.optional(),
    expiresAt: timestamp,
    scope: scopeSchema,
    chain: z.array(z.object({ agent: agentId, at: timestamp, scope: scopeSchema.optional() }).strict()).min(1).max(4)
  })
  .strict()

export type OperatorDecision = z.infer<typeof decisionSchema>
export type OperatorMandate = z.infer<typeof mandateSchema>

/** `interop-agent-call.schema.json` whole, for the test that holds it to the pinned schema. The hub's own tool keeps
 *  its stricter `agentId` and `capability` (`hubTools.ts#callSchema`) and reads these two members with `readCallAuthority`. */
export const agentCallArgsSchema = z
  .object({
    agentId,
    capability: capabilityName,
    input: z.record(z.string(), z.unknown()),
    idempotencyKey: text(1, 256).optional(),
    decision: decisionSchema.optional(),
    mandate: mandateSchema.optional()
  })
  .strict()

export interface CallAuthority { decision?: OperatorDecision; mandate?: OperatorMandate }
export type AuthorityRead = { ok: true; authority: CallAuthority } | { ok: false; detail: 'decision-malformed' | 'mandate-malformed' }

/** The decision and mandate a call carries, checked against their pinned shape; returned as given when valid. */
export function readCallAuthority(args: { decision?: unknown; mandate?: unknown }): AuthorityRead {
  const authority: CallAuthority = {}
  if (args.decision !== undefined) {
    if (!decisionSchema.safeParse(args.decision).success) return { ok: false, detail: 'decision-malformed' }
    authority.decision = args.decision as OperatorDecision
  }
  if (args.mandate !== undefined) {
    if (!mandateSchema.safeParse(args.mandate).success) return { ok: false, detail: 'mandate-malformed' }
    authority.mandate = args.mandate as OperatorMandate
  }
  return { ok: true, authority }
}

/** The callee's refusals the hub passes back unchanged (DL-19 as DEC-0121 and DEC-0125 extend it; C3.5). */
export const OPERATOR_REFUSALS: ReadonlySet<string> = new Set(['operator-decision-required', 'decision-invalid', 'human-step-required'])

/** What the operations log keeps of a hop's decision and mandate (OA-6): when and where the words were said, never the
 *  words themselves, which may name people (AP-2), and never in the journal span, which is the events feed's (OA-7). */
export function operatorRecord(a: CallAuthority): Record<string, unknown> | null {
  if (!a.decision && !a.mandate) return null
  return {
    ...(a.decision ? { decision: { action: a.decision.action, at: a.decision.at, ...(a.decision.source ? { source: a.decision.source } : {}) } } : {}),
    ...(a.mandate ? { mandate: { task: a.mandate.task, at: a.mandate.at, ...(a.mandate.source ? { source: a.mandate.source } : {}), chain: a.mandate.chain.length } } : {})
  }
}
// #endregion hub-call-authority
