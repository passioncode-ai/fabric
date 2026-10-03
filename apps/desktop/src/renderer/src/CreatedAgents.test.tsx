// Creating an agent inside a project (M125, SCN-130 via SCR-74): every state the form can be in —
// reading, unreadable, empty, invalid, saving, failed, created — driven through the real component
// with the bridge stubbed at its edge. Each case asserts what reaches the bridge, not only what is drawn.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { CreatedAgents } from './CreatedAgents'
import { INSTRUCTIONS_MIN, NAME_MAX } from '../../shared/agentSpec.ts'
import type { CreatedAgent, LaunchOption } from '../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const agent = (over: Partial<CreatedAgent> = {}): CreatedAgent =>
  ({ id: 'a1', project_id: 'p1', name: 'Reviewer', runner_id: 'claude-code', instructions: 'x'.repeat(30), mcp_servers: [], ...over }) as CreatedAgent

const option = (over: Partial<LaunchOption>): LaunchOption =>
  ({ id: 'claude-code', label: 'Claude Code', program: 'claude', description: '', available: true, connectsToSurface: true, ...over }) as LaunchOption

const OPTIONS = [option({}), option({ id: 'shell', label: 'Terminal', program: null, available: true, connectsToSurface: false })]
const BRIEF = 'Reviews every pull request against the scenarios.'

function bridge(agents: { list?: () => Promise<CreatedAgent[]>; create?: (i: unknown) => Promise<CreatedAgent> } = {}) {
  const fabric = {
    agents: {
      list: vi.fn(agents.list ?? (async () => [])),
      create: vi.fn(agents.create ?? (async (i: { name: string }) => agent({ id: 'a2', name: i.name })))
    }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric }))
  return fabric
}

function mount(options: LaunchOption[] | null = OPTIONS, servers: string[] = []) {
  render(
    <I18nProvider locale="en">
      <CreatedAgents project={{ id: 'p1', default_agent: 'claude-code', mcp_servers: servers }} options={options} />
    </I18nProvider>
  )
}

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Create an agent' }))
}

describe('creating an agent (M125)', () => {
  it('says it is reading until the list arrives, and only then that there are none', async () => {
    let resolve!: (v: CreatedAgent[]) => void
    bridge({ list: () => new Promise((r) => { resolve = r }) })
    mount()
    expect(screen.getByText('Reading the agents of this project…')).toBeTruthy()
    expect(screen.queryByText('No agents have been created in this project yet.'), 'empty is an answer, not a default').toBeNull()
    resolve([])
    expect(await screen.findByText('No agents have been created in this project yet.')).toBeTruthy()
  })

  it('an unreadable list says so in place, never as an empty project, and Try again reads it again', async () => {
    const fabric = bridge({ list: vi.fn().mockRejectedValueOnce(new Error("Error invoking remote method 'agents:list': Error: agents read failed: timeout")).mockResolvedValueOnce([agent()]) })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('The agents could not be read: agents read failed: timeout')
    expect(alert.textContent, 'the IPC wrapper is not the operator’s problem').not.toContain('invoking remote method')
    expect(screen.queryByText('No agents have been created in this project yet.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Reviewer')).toBeTruthy()
    expect(fabric.agents.list).toHaveBeenCalledTimes(2)
  })

  it('names what is missing instead of greying the button out silently, and sends nothing invalid', async () => {
    const fabric = bridge({ list: async () => [agent()] })
    mount()
    await openForm()
    const create = screen.getByRole('button', { name: 'Create the agent' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    expect(screen.getByText(`At least ${INSTRUCTIONS_MIN} characters, 0 so far.`)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x'.repeat(NAME_MAX + 1) } })
    expect(screen.getByText(`At most ${NAME_MAX} characters.`)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' reviewer ' } })
    expect(screen.getByText('This project already has an agent called reviewer.'), 'one name, one agent — picked by name later').toBeTruthy()
    fireEvent.change(screen.getByLabelText('What it is for'), { target: { value: BRIEF } })
    expect(create.disabled).toBe(true)
    fireEvent.click(create)
    expect(fabric.agents.create).not.toHaveBeenCalled()
  })

  it('while saving, says so and holds every control still', async () => {
    let resolve!: (a: CreatedAgent) => void
    bridge({ create: () => new Promise((r) => { resolve = r }) })
    mount()
    await openForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Planner' } })
    fireEvent.change(screen.getByLabelText('What it is for'), { target: { value: BRIEF } })
    fireEvent.click(screen.getByRole('button', { name: 'Create the agent' }))
    const busy = await screen.findByRole('button', { name: 'Creating…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    resolve(agent({ id: 'a2', name: 'Planner' }))
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('a refused create keeps everything typed and says why, in the form', async () => {
    bridge({ create: async () => { throw new Error("Error invoking remote method 'agents:create': Error: project read failed: offline") } })
    mount()
    await openForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Planner' } })
    fireEvent.change(screen.getByLabelText('What it is for'), { target: { value: BRIEF } })
    fireEvent.click(screen.getByRole('button', { name: 'Create the agent' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The agent was not created: project read failed: offline')
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Planner')
    expect((screen.getByLabelText('What it is for') as HTMLTextAreaElement).value).toBe(BRIEF)
    expect((screen.getByRole('button', { name: 'Create the agent' }) as HTMLButtonElement).disabled, 'it can be tried again').toBe(false)
  })

  it('a created agent is confirmed, listed, and sent with the chosen program and servers only', async () => {
    const made: CreatedAgent[] = []
    const fabric = bridge({
      list: async () => [...made],
      create: async (i) => { const a = agent({ id: 'a2', name: (i as { name: string }).name, runner_id: (i as { runnerId: string }).runnerId }); made.push(a); return a }
    })
    mount(OPTIONS, ['github', 'linear'])
    await openForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Planner ' } })
    fireEvent.change(screen.getByLabelText('What it is for'), { target: { value: BRIEF } })
    fireEvent.change(screen.getByLabelText('Runs in'), { target: { value: 'shell' } })
    fireEvent.click(screen.getByLabelText('github'))
    fireEvent.click(screen.getByRole('button', { name: 'Create the agent' }))
    expect((await screen.findByRole('status')).textContent).toBe('Created Planner.')
    expect(fabric.agents.create).toHaveBeenCalledWith({ projectId: 'p1', name: 'Planner', instructions: BRIEF, runnerId: 'shell', servers: ['github'] })
    expect(await screen.findByText('Planner')).toBeTruthy()
    expect(screen.queryByLabelText('Name'), 'the form closes on success').toBeNull()
  })

  it('with no program available to run it, says so and offers no create', async () => {
    bridge()
    mount([option({ available: false }), option({ id: 'shell', label: 'Terminal', program: null, available: false, connectsToSurface: false })])
    await openForm()
    expect(screen.getByText('No program to run it in is available on this computer.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Planner' } })
    fireEvent.change(screen.getByLabelText('What it is for'), { target: { value: BRIEF } })
    expect((screen.getByRole('button', { name: 'Create the agent' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
