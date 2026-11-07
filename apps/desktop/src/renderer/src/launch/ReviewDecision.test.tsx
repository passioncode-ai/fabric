// CO-521 (SCN-179) and the 0.3.17 review, UX-4: the hand-in line agrees with who handed the task in.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ReviewDecision } from './ReviewDecision'

afterEach(() => cleanup())

const ask = (by: 'agent' | 'person' | 'system', said: string | null) => ({ by, said, at: new Date(Date.now() - 60_000).toISOString() })

describe('ReviewDecision hand-in line', () => {
  it('says «Вы сдали» for the person and «Агент сдал» for the agent, in Russian', () => {
    render(<I18nProvider locale="ru"><ReviewDecision taskId="t" ask={ask('person', null) as never} onDecided={() => {}} /></I18nProvider>)
    expect(screen.getByText(/^Вы сдали работу/)).toBeTruthy()
    expect(screen.getByText(/Вы перевели задачу на проверку без записи/)).toBeTruthy()
    cleanup()
    render(<I18nProvider locale="ru"><ReviewDecision taskId="t" ask={ask('agent', null) as never} onDecided={() => {}} /></I18nProvider>)
    expect(screen.getByText(/^Агент сдал работу/)).toBeTruthy()
    expect(screen.getByText(/Агент не написал, что сделал/)).toBeTruthy()
  })
})
