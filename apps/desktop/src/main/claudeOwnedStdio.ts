/**
 * Claude over owned stdio (first-slice plan B2a, ADR-0081): the Claude control transport joined
 * to the actual pipes of a backend the registry owns.
 *
 * - `claimStdio` is taken exactly once; a second join or a copied handle throws.
 * - The transport closing for any reason — stream end, a malformed frame, a lost write, a local
 *   close — is the registry's `connectionLost`: the owner is fenced for good.
 * - Each request's fence is checked again at the registry's synchronous write edge, after every
 *   authority and descriptor callback, so a command revoked after the transport's own check sends
 *   no bytes. That refusal is the command's, not the owner's: the channel stays open.
 *
 * An ACK is a control receipt, not a stopped turn or a quiescent backend.
 */
import { createClaudeControlTransport, type ClaudeControlRequest, type ClaudeControlResult } from './claudeControlTransport.ts'
import type { OwnedBackendHandle, createOwnedBackendProcessRegistry } from './ownedBackendProcessRegistry.ts'

type Registry = Pick<ReturnType<typeof createOwnedBackendProcessRegistry>, 'claimStdio' | 'connectionLost'>
export interface OwnedClaudeControl {
  requestControl(request: ClaudeControlRequest, stillAllowed: () => boolean): Promise<ClaudeControlResult>
  close(): void
  readonly closed: string | null
}

export function joinOwnedClaudeControl(registry: Registry, handle: OwnedBackendHandle,
  options: { onEvent(event: Readonly<Record<string, unknown>>): void; timeoutMs?: number }): OwnedClaudeControl {
  const pipes = registry.claimStdio(handle)
  const transport = createClaudeControlTransport({
    input: pipes.input, output: pipes.output, edge: pipes.edge, onEvent: options.onEvent, timeoutMs: options.timeoutMs,
    onClosed: () => { try { registry.connectionLost(handle) } catch { /* A retired or foreign handle is already fenced. */ } },
  })
  return {
    requestControl: (request, stillAllowed) => transport.requestControl(request, stillAllowed),
    close: () => transport.close(),
    get closed() { return transport.closed },
  }
}
