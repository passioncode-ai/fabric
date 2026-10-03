// Fabric's look, read once for the window and handed to every avatar (SCR-36). A window whose
// preload predates the look, or a read that fails, shows the default look — labelled as a problem
// where there is one, never passed off as the operator's choice.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DEFAULT_PERSONA, type Persona } from '../../../shared/persona.ts'
import type { PersonaWrite } from '../../../shared/types'
import { useT } from '../i18n'

interface PersonaState {
  persona: Persona
  chosen: boolean
  problem: string | null
  save: (next: Persona) => Promise<PersonaWrite>
}

const PersonaContext = createContext<PersonaState>({
  persona: DEFAULT_PERSONA, chosen: false, problem: null,
  save: async (next) => ({ persona: next, saved: false, reason: 'no persona store in this window' })
})

export function PersonaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<{ persona: Persona; chosen: boolean; problem: string | null }>({ persona: DEFAULT_PERSONA, chosen: false, problem: null })
  useEffect(() => {
    let alive = true
    try {
      window.fabric.persona?.read().then(
        (r) => alive && setState({ persona: r.persona, chosen: r.chosen, problem: r.problem ?? null }),
        (e: unknown) => alive && setState((s) => ({ ...s, problem: e instanceof Error ? e.message : String(e) }))
      )
    } catch (e) {
      setState((s) => ({ ...s, problem: e instanceof Error ? e.message : String(e) }))
    }
    return () => { alive = false }
  }, [])
  const save = useCallback(async (next: Persona): Promise<PersonaWrite> => {
    const r = await window.fabric.persona.save(next)
    // What is on disk is what the window shows, saved or not. A refused save is the caller's to say;
    // it is not a problem READING the look, which is what `problem` reports.
    setState((s) => ({ persona: r.persona, chosen: r.saved || s.chosen, problem: r.saved ? null : s.problem }))
    return r
  }, [])
  return <PersonaContext.Provider value={{ ...state, save }}>{children}</PersonaContext.Provider>
}

export function usePersona(): PersonaState {
  return useContext(PersonaContext)
}

/**
 * What the operator calls their Fabric (ADR-0100): the name kept in the persona, or the product name
 * when none was given. Shown wherever Fabric speaks as the agent; the product's own brand stays "Fabric".
 */
export function useFabricName(fallback: string): string {
  return useContext(PersonaContext).persona.name ?? fallback
}

/** The agent's name as an element, for places that render inside the persona provider. */
export function FabricName(): React.JSX.Element {
  const t = useT()
  return <>{useFabricName(t('launch.brand.product'))}</>
}
