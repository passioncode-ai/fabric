/**
 * One writer per conversation, and the account frozen at admission.
 *
 * M199.binding. Built on `localState` for the same reason the account register
 * is: the revision, the atomic write and the quarantine of unreadable bytes
 * were bought once in S14, and a second version of them would be a second thing
 * to keep right.
 *
 * NOT IN THE JOURNAL. A binding names a provider's local conversation store and
 * a config home on one machine; replicating it to every window and every replica
 * of the estate would put a device-local route in the estate's own record. What
 * the journal holds is the run — S04's admission and AX-01's lifecycle — and this
 * points at it rather than duplicating it.
 *
 * The two operations that look alike and are not: `setProjectBinding` changes
 * what the NEXT admission resolves, and it touches no live conversation.
 * `admit` resolves the order once and writes it down. Nothing here moves a
 * running conversation to another account — that is M199.resume's, and it needs
 * a native resume acknowledgement which M199.probe measured as unverified on
 * both installed builds.
 */

import { readLocal, writeLocal, type LocalFile } from './localState.ts'
import {
  mayDispatch,
  mayWrite,
  pinStrength,
  resolveAccount,
  type ConversationBinding,
  type PinVerdict,
  type Resolved,
  type WriteVerdict
} from '../shared/conversationBinding.ts'
import type { ProviderCapabilityReceipt } from '../shared/providerCapability.ts'

interface BindingFile {
  schema: 'ConversationBindings@1'
  bindings: ConversationBinding[]
  /** projectId → provider → accountId. What the next admission resolves. */
  projectBindings: Record<string, Record<string, string>>
}

const EMPTY: BindingFile = { schema: 'ConversationBindings@1', bindings: [], projectBindings: {} }

function validate(parsed: unknown): BindingFile | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Partial<BindingFile>
  if (o.schema !== 'ConversationBindings@1') return null
  if (!Array.isArray(o.bindings)) return null
  if (!o.projectBindings || typeof o.projectBindings !== 'object') return null
  for (const b of o.bindings)
    if (!b || typeof b.conversationId !== 'string' || typeof b.bindingRevision !== 'number') return null
  return {
    schema: 'ConversationBindings@1',
    bindings: o.bindings,
    projectBindings: o.projectBindings as Record<string, Record<string, string>>
  }
}

export interface Admitted {
  ok: true
  binding: ConversationBinding
  resolved: Resolved
  pin: PinVerdict
}

export interface Refused {
  ok: false
  reason: string
}

export interface RegistryDeps {
  dir: string
  matrix: readonly ProviderCapabilityReceipt[]
  builds: Readonly<Record<string, string>>
  runtime: string
  /** The store's current auth revision for an account, for the drift check. */
  authRevisionOf: (provider: string, accountId: string | null) => number | null
}

export function createConversationRegistry(deps: RegistryDeps) {
  const spec: LocalFile<BindingFile> = {
    dir: deps.dir,
    file: 'conversation-bindings.json',
    empty: EMPTY,
    validate
  }
  const read = (): BindingFile => readLocal(spec).value

  const find = (conversationId: string): ConversationBinding | null =>
    read().bindings.find((b) => b.conversationId === conversationId) ?? null

  return {
    binding: find,

    /** Every live binding, so a caller can show what a default change did NOT do. */
    bindings: (): readonly ConversationBinding[] => read().bindings,

    /**
     * What the NEXT admission for this project resolves to.
     *
     * Deliberately separate from anything live. The card's first failure case is
     * that changing this must leave conversations A and C exactly where they
     * are, and the way to guarantee that is for this function to be unable to
     * reach them: it writes one map and touches no binding.
     */
    setProjectBinding(input: {
      projectId: string
      provider: string
      accountId: string
      expectedRevision: string
    }): { ok: boolean; reason: string } {
      const file = read()
      const next: BindingFile = {
        ...file,
        projectBindings: {
          ...file.projectBindings,
          [input.projectId]: { ...(file.projectBindings[input.projectId] ?? {}), [input.provider]: input.accountId }
        }
      }
      const written = writeLocal(spec, next, input.expectedRevision)
      if (written.status === 'conflict')
        return { ok: false, reason: 'the register changed while this was being set; nothing was written' }
      if (written.status === 'failed') return { ok: false, reason: written.reason }
      const live = file.bindings.filter((b) => b.projectId === input.projectId && b.provider === input.provider)
      return {
        ok: true,
        reason:
          `future admissions in this project resolve to ${input.accountId}. ` +
          `${live.length} live conversation(s) keep the account they were admitted with — changing where new work ` +
          `goes is a different act from moving work that is already running`
      }
    },

    /** The token `setProjectBinding` and `write` compare against. */
    revision: (): string => readLocal(spec).revision,

    /**
     * Resolve the order ONCE and write the binding down.
     *
     * Resolving it again later is the defect this shape exists to prevent: a
     * default change would then reach a conversation that had already started.
     */
    admit(input: {
      conversationId: string
      projectId: string
      provider: string
      nativeRef: string | null
      workspaceFingerprint: string
      explicit?: string | null
      providerDefault?: string | null
      expectedRevision: string
    }): Admitted | Refused {
      const build = deps.builds[input.provider]
      if (!build)
        return { ok: false, reason: `no build is recorded for ${input.provider}, so nothing can be said about pinning` }
      const file = read()
      if (file.bindings.some((b) => b.conversationId === input.conversationId))
        return {
          ok: false,
          reason:
            `${input.conversationId} is already admitted. One native conversation does not get two writers, and a ` +
            `second admission is how it would`
        }
      // A native reference already bound elsewhere is the same collision, seen
      // from the provider's side rather than ours.
      if (input.nativeRef && file.bindings.some((b) => b.nativeRef === input.nativeRef))
        return {
          ok: false,
          reason: `the provider conversation ${input.nativeRef} is already bound; two writers on one native history`
        }

      const resolved = resolveAccount({
        explicit: input.explicit ?? null,
        projectBinding: file.projectBindings[input.projectId]?.[input.provider] ?? null,
        providerDefault: input.providerDefault ?? null
      })
      const authRevision = deps.authRevisionOf(input.provider, resolved.accountId)
      if (authRevision === null)
        return {
          ok: false,
          reason:
            'the account has no readable auth revision, so what this conversation would be frozen against is unknown ' +
            '— and an unknown is not something to freeze'
        }

      const binding: ConversationBinding = {
        conversationId: input.conversationId,
        projectId: input.projectId,
        provider: input.provider,
        nativeRef: input.nativeRef,
        accountId: resolved.accountId,
        authRevision,
        runtime: deps.runtime,
        workspaceFingerprint: input.workspaceFingerprint,
        bindingRevision: 1,
        sessionGeneration: 1
      }
      const written = writeLocal(spec, { ...file, bindings: [...file.bindings, binding] }, input.expectedRevision)
      if (written.status !== 'committed')
        return {
          ok: false,
          reason:
            written.status === 'conflict'
              ? 'the register changed while this admission was being written; nothing was admitted'
              : `the binding could not be saved: ${written.reason}`
        }
      return {
        ok: true,
        binding,
        resolved,
        pin: pinStrength({ matrix: deps.matrix, provider: input.provider, cliBuild: build, accountId: resolved.accountId })
      }
    },

    /**
     * Write to a binding, or refuse for one of four named reasons.
     *
     * The refusal is the product here. A late callback from a replaced session
     * carries a true statement about a process nobody is watching, and applying
     * it would move the binding backwards.
     */
    write(input: {
      conversationId: string
      expectedRevision: number
      sessionGeneration: number
      projectId: string
      workspaceFingerprint: string
      patch: Partial<Pick<ConversationBinding, 'nativeRef' | 'sessionGeneration'>>
      fileRevision: string
    }): (WriteVerdict & { binding?: ConversationBinding }) | Refused {
      const binding = find(input.conversationId)
      if (!binding) return { ok: false, reason: 'no such conversation is admitted here' }
      const verdict = mayWrite(binding, {
        expectedRevision: input.expectedRevision,
        sessionGeneration: input.sessionGeneration,
        projectId: input.projectId,
        workspaceFingerprint: input.workspaceFingerprint,
        runtime: deps.runtime
      })
      if (!verdict.allowed) return verdict
      const file = read()
      const next: ConversationBinding = {
        ...binding,
        ...input.patch,
        bindingRevision: binding.bindingRevision + 1,
        sessionGeneration: input.patch.sessionGeneration ?? binding.sessionGeneration
      }
      const written = writeLocal(
        spec,
        { ...file, bindings: file.bindings.map((b) => (b.conversationId === next.conversationId ? next : b)) },
        input.fileRevision
      )
      if (written.status !== 'committed')
        return {
          allowed: false,
          refusal: 'stale-revision',
          reason:
            written.status === 'conflict'
              ? 'the register changed under this write; the binding is unchanged'
              : `the binding could not be saved: ${written.reason}`
        }
      return { ...verdict, binding: next }
    },

    /**
     * May work be dispatched against this conversation right now?
     *
     * Separate from `write` because a revision that moved between the read and
     * the spawn is not a conflicting writer — it is the credential being
     * replaced underneath, and the answer is to stop rather than to retry.
     */
    mayDispatch(conversationId: string): { allowed: boolean; reason: string } {
      const binding = find(conversationId)
      if (!binding) return { allowed: false, reason: 'no such conversation is admitted here' }
      return mayDispatch({
        binding,
        observedAuthRevision: deps.authRevisionOf(binding.provider, binding.accountId)
      })
    },

    /** What a person is told about pinning, which is not always a promise. */
    pinOf(conversationId: string): PinVerdict | null {
      const binding = find(conversationId)
      if (!binding) return null
      const build = deps.builds[binding.provider]
      if (!build) return { strength: 'drifting', reason: 'no build is recorded for this provider' }
      return pinStrength({
        matrix: deps.matrix,
        provider: binding.provider,
        cliBuild: build,
        accountId: binding.accountId
      })
    }
  }
}
