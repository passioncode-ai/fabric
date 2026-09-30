import type { ReactNode } from 'react'

/**
 * What an agent SAYS about itself, and what Fabric OBSERVED — side by side and
 * never merged (M117, ADR-0008).
 *
 * The two live in one file because they only mean anything together. A stage
 * with no age beside an observation is the exact confusion this product exists
 * to prevent: a claim from three hours ago and a measurement from four seconds
 * ago look identical unless something separates them, so `age` is required and
 * `stale` is rendered rather than left to the reader's arithmetic.
 *
 * Reused by the project page's agent tile and by the estate agents screen, which
 * is why it is in the set rather than inside one of them.
 */
export function Claim({
  label,
  stage,
  age,
  stale,
  staleTitle
}: {
  /** Names the agent as the source — "the agent says". Never omitted. */
  label: ReactNode
  stage: ReactNode
  /** How long ago it was said. Required: without it the claim reads as current. */
  age: ReactNode
  /** True when the account is materially older than the last observed activity. */
  stale?: boolean
  staleTitle?: string
}): React.JSX.Element {
  return (
    <p className={stale ? 'claim claim-stale' : 'claim'}>
      <span className="claim-label">{label}</span>
      <span className="claim-stage">{stage}</span>
      <span className="claim-age" title={stale ? staleTitle : undefined}>
        {age}
      </span>
    </p>
  )
}

/**
 * The last line an agent printed — the OBSERVATION that sits beside the claim.
 * Monospace and truncated to one line: it is a glance, not a transcript.
 */
export function Tail({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="tail">{children}</p>
}
