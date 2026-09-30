// What a session in this project is given — and what the panel cannot know
// (UX28-05).
//
// Three claims sat in one snapshot and only one of them was true.
//
// FIRST, THE COUNT THAT COULD NOT FAIL. The grant figures came from three
// `{ count: 'exact', head: true }` reads whose `error` was never looked at, and
// then `live.count ?? 0`. A refused read became "no live authority here",
// which is the most reassuring answer the panel can give and the one it has no
// evidence for. This is the FIFTH appearance of one shape in this repository —
// FA-04, FA-03, FA-02 and the 414 each closed one — and the difference here is
// that the empty answer is not merely wrong, it is wrong in the direction of
// "nothing is authorised", which an auditor would read as safe.
//
// SECOND, THE SCOPE. The handler took `projectId` and never used it: every
// grant figure was estate-wide, so two projects rendered the same snapshot and
// the panel titled it as this project's harness. `grants` has no `project_id`
// column at all — the card names both routes and only one of them exists, so
// the counts are LABELLED estate-wide rather than filtered.
//
// THIRD, THE THREE THINGS CALLED "AGENTS". `launchOptions()` reports what this
// MACHINE has installed. The agents created IN this project are a different
// list, read by a different call, and the panel showed neither of those
// distinctions: a runner present on the machine and an agent bound to the
// project appeared as one kind of row.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { HarnessSection } from './HarnessSection'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { SURFACE_TOOLS } from '../../shared/surfaceTools'
import { envelope, type ReadEnvelope } from '../../shared/readEnvelope'
import type { Harness, ProjectRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = (id = 'p1'): ProjectRow =>
  ({ id, name: id, default_agent: 'claude-code' }) as ProjectRow

/**
 * A source that answered, and one that refused — built through the REAL
 * `envelope`, not a literal.
 *
 * The first version of this fixture invented a `{ state: 'ready' | 'failed' }`
 * shape of my own. `ReadEnvelope` (S14) already exists for exactly this, and
 * its own `NoSources` says why: "an answer carrying no measurement is the
 * confident zero this type exists to prevent" — which is this card's defect,
 * word for word. Using the real constructor also means these fixtures cannot
 * express a state the product cannot produce, and `availability` is DERIVED
 * here as it is in production rather than asserted by me.
 */
const AT = '2026-09-10T00:00:00.000Z'
const answered = <T,>(data: T): ReadEnvelope<T> =>
  envelope<T>({ data, sources: [{ name: 'source', status: 'ok', asOf: AT }], asOf: AT })
const refused = <T,>(why: string, data: T): ReadEnvelope<T> =>
  envelope<T>({ data, sources: [{ name: 'source', status: 'error', asOf: null, errorCode: why }] })

const harness = (over: Partial<Harness> = {}): Harness => ({
  scope: { projectId: 'p1', estateWide: ['grants'] },
  providers: answered([
    {
      id: 'claude-code',
      description: 'Claude Code',
      available: true,
      permissionModes: [{ id: 'ask' }]
    }
  ] as Harness['providers']['data'] & object),
  projectAgents: answered([{ id: 'a1', name: 'The auditor' }]),
  servers: answered([{ name: 'fabric', endpoint: 'http://127.0.0.1:1/mcp', strict: true }]),
  tools: [...SURFACE_TOOLS],
  grants: answered({ live: 2, spent: 5, expired: 1 }),
  ...over
})

function stub(read: (projectId: string) => Promise<Harness>) {
  const api = { harness: { read: vi.fn(read) } }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const show = (p = project(), onError = vi.fn()) =>
  render(
    <I18nProvider locale="en">
      <HarnessSection project={p} feedMark={0} onError={onError} />
    </I18nProvider>
  )

describe('a refused count is not a count of zero', () => {
  it('says the grant figures are unavailable, with the reason', async () => {
    // THE MEASURED DEFECT, and the direction matters: "0 live grants" reads as
    // "nothing is authorised here", which is the reassuring answer and the one
    // the panel has no evidence for.
    stub(async () => harness({ grants: refused('the grants table refused', { live: 2, spent: 5, expired: 1 }) }))
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-grants-failed')).toBeTruthy())
    expect(screen.getByTestId('harness-grants-failed').textContent).toMatch(/the grants table refused/)
    // And no number is shown at all — not a zero, not a dash pretending to be
    // one.
    expect(screen.queryByTestId('harness-grants')).toBeNull()
  })

  it('and a real zero still reads as zero, because that is a measurement', async () => {
    stub(async () => harness({ grants: answered({ live: 0, spent: 0, expired: 0 }) }))
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-grants')).toBeTruthy())
    expect(screen.queryByTestId('harness-grants-failed')).toBeNull()
  })
})

describe('the panel says which of its figures are estate-wide', () => {
  it('labels the grant counts as estate-wide rather than implying this project', async () => {
    // `grants` has no `project_id` column, so a grant is an estate-level
    // object by its own schema. The card offers two routes — filter by
    // project, or label the estate-only counts — and only the second exists.
    stub(async () => harness())
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-grants')).toBeTruthy())
    expect(screen.getByTestId('harness-estate-wide').textContent).toMatch(/estate/i)
  })

  it('and the scope it was read for is the project it was asked about', async () => {
    const api = stub(async (projectId) => harness({ scope: { projectId, estateWide: ['grants'] } }))
    show(project('p2'))
    await waitFor(() => expect(api.harness.read).toHaveBeenCalledWith('p2'))
  })
})

describe('three different things were all called "agents"', () => {
  it('what the MACHINE has installed and what this PROJECT has created are separate lists', async () => {
    stub(async () => harness())
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-providers')).toBeTruthy())
    expect(screen.getByTestId('harness-providers').textContent).toMatch(/Claude Code/)
    expect(screen.getByTestId('harness-project-agents').textContent).toMatch(/The auditor/)
  })

  it('and a project with no agents of its own says so rather than showing the machine’s', async () => {
    stub(async () => harness({ projectAgents: answered([]) }))
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-project-agents')).toBeTruthy())
    expect(screen.getByTestId('harness-project-agents').textContent).toMatch(
      new RegExp(en['harness.noProjectAgents'].slice(0, 20))
    )
  })

  it('and an installed provider that is not signed in cannot read as launch-ready', async () => {
    // Declarative configuration, observed capability and actual authorisation
    // are three things. A runner present on the machine and unavailable to a
    // session is not a runner this project can use.
    stub(async () =>
      harness({
        providers: answered([
          { id: 'codex', description: 'Codex', available: false, permissionModes: [] }
        ] as Harness['providers']['data'] & object)
      })
    )
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-providers')).toBeTruthy())
    expect(screen.getByTestId('harness-providers').textContent).toMatch(
      new RegExp(en['harness.unavailable'])
    )
  })
})

describe('each source fails on its own', () => {
  it('a failed provider read leaves the servers and the tools on screen', async () => {
    stub(async () =>
      harness({ providers: refused('the runners could not be listed', []) })
    )
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-providers-failed')).toBeTruthy())
    expect(screen.getByTestId('harness-providers-failed').textContent).toMatch(
      /the runners could not be listed/
    )
    // The reason INSTEAD of the content, not beside it. An empty list block
    // next to a failure line is what makes the guard load-bearing rather than
    // decorative — and it is the difference between "nothing is installed" and
    // "we could not ask".
    expect(screen.queryByTestId('harness-providers')).toBeNull()
    // The tool contract is a constant in this process — it cannot fail, and it
    // is still there when a read beside it does.
    expect(screen.getByText(SURFACE_TOOLS[0].name)).toBeTruthy()
  })

  it('and a read that has not answered yet is not an empty answer', async () => {
    stub(() => new Promise<Harness>(() => {}))
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-reading')).toBeTruthy())
    // NOT "no server configured" — that is a claim, and nothing has been read.
    expect(screen.queryByText(en['harness.noServer'])).toBeNull()
  })
})

describe('the tool contract is the one the surface registers', () => {
  it('every declared tool is rendered', async () => {
    stub(async () => harness())
    show()
    await waitFor(() => expect(screen.queryByTestId('harness-providers')).toBeTruthy())
    for (const tool of SURFACE_TOOLS) expect(screen.getByText(tool.name)).toBeTruthy()
  })

  it('and the panel quotes no count it has not computed', async () => {
    // The header comment used to say "sixteen tools exist and eleven write to
    // the journal". Measured 2026-09-10: 22, 17 and 5. The ARGUMENT was still
    // right and the numbers had drifted, which is the failure mode a number in
    // prose has.
    const source = en['harness.noCounts']
    expect(source).not.toMatch(/sixteen|eleven|\b1[0-9]\b|\b2[0-9]\b/)
  })
})
