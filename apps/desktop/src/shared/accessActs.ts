// #region hub-consent — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// Why the operator's act on a request, a grant, a credential or a denial was not done — as a CODE the
// renderer phrases in the operator's language (en/ru), never as an English sentence carried across IPC.
// `reason` beside it stays English for the operations log only.

export type AccessActRefusal =
  /** No request, grant, credential or denial with that id in this estate. */
  | 'not-found'
  /** The request was already allowed or denied. */
  | 'already-decided'
  /** The request expired before it was answered; the agent must ask again. */
  | 'expired'
  /** The credential that asked for more has been revoked; the agent must ask again from the start. */
  | 'asking-binding-revoked'
  /** The grant or credential is not live any more (already revoked). */
  | 'not-live'
  /** Fabric could not read or write agent access just now. */
  | 'unavailable'

export const ACCESS_ACT_REFUSALS: readonly AccessActRefusal[] = ['not-found', 'already-decided', 'expired', 'asking-binding-revoked', 'not-live', 'unavailable']

/** The answer to an operator's act: done, or refused with a code (and the log-only English reason). */
export type AccessActAnswer = { ok: true } | { ok: false; code: AccessActRefusal; reason: string }
// #endregion hub-consent
