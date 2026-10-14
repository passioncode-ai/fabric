// One read on mount for a settings panel: its value, its failure, or null while it is out (SettingsScreen.tsx).
import { useEffect, useState } from 'react'

export type Read<T> = { value: T } | { failed: string } | null

export type Reader<T> = () => Promise<T>

/** One read on mount: its value, its failure, or null while it is out. */
export function useRead<T>(read: Reader<T>) {
  const [r, setR] = useState(null as Read<T>)
  useEffect(() => {
    let alive = true
    // Through a promise, so a build without the reading is said rather than thrown out of the effect.
    Promise.resolve().then(read).then(
      (value) => alive && setR({ value }),
      (e: unknown) => alive && setR({ failed: e instanceof Error ? e.message : String(e) })
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per mount
  }, [])
  return r
}
