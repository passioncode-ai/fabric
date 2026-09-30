import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PersonaScreen } from './PersonaScreen'
import { PersonaProvider } from './persona'
import { FabricAvatar } from './FabricAvatar'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount(read: unknown = { persona: { seed: 731, style: 'orbit' }, chosen: false }, save = vi.fn(async (next: unknown) => ({ persona: next, saved: true }))) {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { persona: { read: vi.fn(async () => read), save } } }))
  const onDone = vi.fn()
  render(
    <I18nProvider locale="en">
      <PersonaProvider>
        <PersonaScreen onDone={onDone} />
        <div data-testid="elsewhere"><FabricAvatar size="tiny" label="Fabric" /></div>
      </PersonaProvider>
    </I18nProvider>
  )
  return { save, onDone }
}
const shownLook = () => {
  const face = document.querySelector('[data-testid="elsewhere"] .fp-face') as HTMLElement
  return { seed: face.dataset.avatarSeed, style: face.dataset.avatarStyle }
}

describe('your Fabric (SCR-36)', () => {
  it('keeps the chosen character and variant, and every avatar in the window takes it', async () => {
    const { save, onDone } = mount()
    await waitFor(() => expect(screen.getByText(en['launch.persona.ledeFirst'])).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['launch.persona.style.spark']) }))
    fireEvent.click(screen.getByRole('button', { name: en['launch.persona.more'] }))
    fireEvent.click(screen.getByRole('button', { name: en['launch.persona.variantN'].replace('{n}', '2') }))
    expect(shownLook(), 'the look changed before it was kept').toEqual({ seed: '731', style: 'orbit' })
    fireEvent.click(screen.getByRole('button', { name: en['launch.persona.save'] }))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ seed: 781, style: 'spark' }))
    await waitFor(() => expect(shownLook()).toEqual({ seed: '781', style: 'spark' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('a look that was not saved says why, stays on the screen, and the window keeps the stored one', async () => {
    const save = vi.fn(async () => ({ persona: { seed: 731, style: 'orbit' }, saved: false, reason: 'another window changed the look' }))
    const { onDone } = mount(undefined, save)
    await waitFor(() => expect(screen.getByRole('button', { name: en['launch.persona.save'] })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['launch.persona.style.wave']) }))
    fireEvent.click(screen.getByRole('button', { name: en['launch.persona.save'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/another window/))
    expect(onDone).not.toHaveBeenCalled()
    expect(shownLook().style).toBe('orbit')
  })

  it('an unreadable stored look is said, and the default is not presented as a choice', async () => {
    mount({ persona: { seed: 731, style: 'orbit' }, chosen: false, problem: 'local_state_read_failed' })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/local_state_read_failed/))
    expect(screen.getByText(en['launch.persona.ledeFirst'])).toBeTruthy()
  })
})
