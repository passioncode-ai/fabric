// SCN-132 in the attention queue (security review of PR #7). Allow in the queue is the same decision as
// Allow in the native prompt, so the row says what the prompt says before either button: who the
// registry says is asking, the agent's reason as its own one-line claim, the same-user floor, and
// whether this adds to access the agent already holds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ObligationActs, useProposalDecisions, type ObligationLike } from './ObligationActs'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { consentFacts, SAME_USER_FLOOR } from '../../../shared/access'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const facts = consentFacts({
  agentId: 'example-agent.default',
  registry: { name: 'Example agent', installed_by: 'example-installer', repository: 'https://github.com/example/example-agent' },
  reason: 'summarise the newsletter',
  incremental: true
})
const item: ObligationLike = {
  subject: { kind: 'access-request', id: 'r1' },
  projectId: null,
  access: { requestId: 'r1', callee: 'fabric-inbox', expiresAt: '2026-10-03T10:10:00Z', ...facts }
}

function Harness(): React.JSX.Element {
  const decisions = useProposalDecisions(async () => {}, () => {})
  return <ObligationActs item={item} decisions={decisions} onOpen={() => {}} onError={() => {}} />
}

describe('an access request in the queue', () => {
  it('states the prompt\'s facts before Allow, and Allow decides that request', async () => {
    const decide = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="en"><Harness /></I18nProvider>)
    expect(screen.getByText(facts.origin)).toBeTruthy()
    expect(screen.getByText(en['access.pending.reason'].replace('{reason}', 'summarise the newsletter'))).toBeTruthy()
    expect(screen.getByText(SAME_USER_FLOOR)).toBeTruthy()
    expect(screen.getByText('This agent already has access through Fabric; this adds to it.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['access.allow'] }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('r1', 'allowed'))
  })
})
