// Fabric's look for this operator (SCR-36), kept beside the pins: operator-local, not journalled,
// validated field by field so a hand-edited file costs the look, never the screen.

import { localStore } from './localStore.ts'
import { DEFAULT_PERSONA, validatePersona, type Persona } from '../shared/persona.ts'
import type { PersonaRead, PersonaWrite } from '../shared/types.ts'

const store = localStore<Persona>('persona.json', DEFAULT_PERSONA, validatePersona)

export function persona(): PersonaRead {
  const read = store.read()
  // `chosen` tells a first look from a kept one: the screen invites a choice only when none was made.
  // An unreadable file is said, not shown as the default being someone's choice.
  return {
    persona: read.value,
    chosen: read.status !== 'default_missing' && read.status !== 'unreadable',
    ...(read.status === 'unreadable' ? { problem: read.error ?? 'unreadable' } : {})
  }
}

export function savePersona(input: unknown): PersonaWrite {
  const next = validatePersona(input)
  if (!next) return { persona: store.read().value, saved: false, reason: 'not a look this build knows' }
  const current = store.read()
  const result = store.write(next, current.revision)
  if (result.status === 'committed') return { persona: result.value, saved: true }
  if (result.status === 'conflict') return { persona: result.currentValue, saved: false, reason: 'another window changed the look' }
  return { persona: current.value, saved: false, reason: result.reason }
}
