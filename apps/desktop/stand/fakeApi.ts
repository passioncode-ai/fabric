// The stand's `window.fabric`: every call the screens make answers from the fixture of its dotted name
// (`work.session`, `tasks.detail`); a subscription answers an unsubscribe; a call with no fixture answers null and
// is listed in `window.__standUnknown`, so the suite can fail on a screen reading something the stand never fed.
export type Fixtures = Record<string, unknown>

export function fakeApi(fx: Fixtures): unknown {
  const unknown = new Set<string>()
  ;(window as unknown as { __standUnknown: Set<string> }).__standUnknown = unknown
  const make = (path: string[]): unknown => new Proxy(function () {}, {
    get(_t, k) {
      if (k === 'then' || typeof k === 'symbol') return undefined
      return make([...path, String(k)])
    },
    apply(_t, _this, args: unknown[]) {
      const key = path.join('.')
      const last = path[path.length - 1] ?? ''
      if (/^on[A-Z]/.test(last) || last === 'subscribe') return () => {}
      const v = fx[key]
      if (typeof v === 'function') return Promise.resolve().then(() => (v as (...a: unknown[]) => unknown)(...args))
      if (v === undefined) { unknown.add(key); return Promise.resolve(null) }
      return Promise.resolve(JSON.parse(JSON.stringify(v)))
    }
  })
  return make([])
}
