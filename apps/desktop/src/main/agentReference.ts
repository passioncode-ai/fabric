/**
 * A reference an agent names (a path, a target, a key) must not carry an authority or a secret (`authorityIngress.ts`):
 * shared by every session tool, moved out of `agentSurface.ts` with the tools that left it (the screens waves S2).
 */
import { checkAuthorityTarget } from '../shared/authorityIngress.ts'
import { CommandIngressError } from './commandIngressAdapters.ts'

/** Check the complete original before lookup, normalization or legacy text
 * scrubbing. Reference identity is preserved; recognizable secrets refuse the
 * command rather than producing a different target/name. */
export function assertAgentReference(value: string | undefined): void {
  if (value !== undefined && !checkAuthorityTarget(value).ok)
    throw new CommandIngressError('secret_in_reference')
}
