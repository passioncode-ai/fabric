import { describe, expect, it } from 'vitest'
import { normaliseRepository, routeForLink, type LinkRouteDeps } from './linkRoute.ts'

const deps = (over: Partial<LinkRouteDeps> = {}): LinkRouteDeps => ({
  projects: [
    { id: 'p-atlas', name: 'Atlas', remotes: ['git@github.com:acme/atlas.git'] },
    { id: 'p-site', name: 'Site', remotes: ['https://github.com/acme/site'] }
  ],
  services: [
    { key: 'atlas-agent.default', id: 'atlas-agent', repository: 'https://github.com/acme/atlas' },
    { key: 'orphan.default', id: 'orphan', repository: 'https://github.com/acme/elsewhere' },
    { key: 'norepo.default', id: 'norepo', repository: null }
  ],
  ...over
})

describe('normaliseRepository', () => {
  it('reads the scp form, .git and a trailing slash as one repository', () => {
    expect(normaliseRepository('git@github.com:Acme/Atlas.git')).toBe('github.com/acme/atlas')
    expect(normaliseRepository('https://github.com/acme/atlas/')).toBe('github.com/acme/atlas')
    expect(normaliseRepository('ssh://git@github.com/acme/atlas.git')).toBe('github.com/acme/atlas')
    expect(normaliseRepository('not a url')).toBeNull()
  })
})

describe('routeForLink', () => {
  it('a chat link with a project opens that project, by id or by name', () => {
    expect(routeForLink('fabric://chat?project=p-site', deps())).toEqual({ route: { kind: 'project', projectId: 'p-site' }, notice: 'conversation-soon' })
    expect(routeForLink('fabric://chat?project=atlas', deps())).toEqual({ route: { kind: 'project', projectId: 'p-atlas' }, notice: 'conversation-soon' })
  })

  it('a chat link with only a service opens the project that holds its repository', () => {
    expect(routeForLink('fabric://chat?service=atlas-agent.default', deps())).toEqual({ route: { kind: 'project', projectId: 'p-atlas' }, notice: 'conversation-soon' })
    expect(routeForLink('fabric://chat?service=atlas-agent', deps())).toEqual({ route: { kind: 'project', projectId: 'p-atlas' }, notice: 'conversation-soon' })
  })

  it('a service in no project, without a repository, or unknown opens home and says which', () => {
    expect(routeForLink('fabric://chat?service=orphan.default', deps())).toEqual({ route: { kind: 'home' }, notice: 'service-in-no-project' })
    expect(routeForLink('fabric://chat?service=norepo.default', deps())).toEqual({ route: { kind: 'home' }, notice: 'service-in-no-project' })
    expect(routeForLink('fabric://chat?service=nobody.default', deps())).toEqual({ route: { kind: 'home' }, notice: 'service-unknown' })
  })

  it('a project the link names that Fabric does not have opens home', () => {
    expect(routeForLink('fabric://chat?project=ghost', deps())).toEqual({ route: { kind: 'home' }, notice: 'project-unknown' })
    expect(routeForLink('fabric://session/new?project=ghost', deps())).toEqual({ route: { kind: 'home' }, notice: 'project-unknown' })
  })

  it('a session link opens its project, ready to start a session', () => {
    expect(routeForLink('fabric://session/new?project=p-atlas&runner=codex', deps())).toEqual({ route: { kind: 'project', projectId: 'p-atlas' }, notice: 'start-session' })
  })

  it('a link the contract refuses opens nothing but home, and acts on nothing', () => {
    expect(routeForLink('fabric://chat?project=p-atlas&prompt=delete%20everything', deps())).toEqual({ route: { kind: 'home' }, notice: 'link-refused' })
    expect(routeForLink('fabric://run?project=p-atlas', deps())).toEqual({ route: { kind: 'home' }, notice: 'link-refused' })
    expect(routeForLink('https://example.com', deps())).toEqual({ route: { kind: 'home' }, notice: 'link-refused' })
  })

  it('two projects holding the service repository: home, never a guess between them', () => {
    const d = deps({ projects: [
      { id: 'p-b', name: 'Beta', remotes: ['https://github.com/acme/atlas'] },
      { id: 'p-a', name: 'Alpha', remotes: ['git@github.com:acme/atlas.git'] }
    ] })
    expect(routeForLink('fabric://chat?service=atlas-agent.default', d)).toEqual({ route: { kind: 'home' }, notice: 'service-in-many-projects' })
  })
})

import { linkWindowPlan, resolveLink } from './linkRoute.ts'

// 0.3.5 review ER-1 / UX-14: a project list that could not be read is never an empty one. Routing against [] told the
// person the project was not in their list (or the repository in none of their projects) and pushed them toward a
// duplicate; a read that threw only logged, and the click did nothing.
describe('resolveLink: a failed read says so, never routes against an empty list', () => {
  const services = () => deps().services
  const ok = { projects: async () => deps().projects.map(({ id, name }) => ({ id, name })), remotes: async (id: string) => deps().projects.find((p) => p.id === id)?.remotes ?? [], services }
  it('reads the projects and their repositories, then routes', async () => {
    const failed: unknown[] = []
    expect(await resolveLink('fabric://chat?service=atlas-agent.default', { ...ok, failed: (e) => failed.push(e) })).toEqual({ route: { kind: 'project', projectId: 'p-atlas' }, notice: 'conversation-soon' })
    expect(failed).toEqual([])
  })
  for (const [what, broken] of [
    ['the projects read fails', { projects: async () => { throw new Error('projects could not be read: fetch failed') } }],
    ['a repositories read fails', { remotes: async () => { throw new Error("the project's repositories could not be read") } }],
    ['the registry throws', { services: () => { throw new Error('registry unreadable') } }]
  ] as const)
    it(`${what}: link-unreadable, at home, and the failure goes to the log`, async () => {
      const failed: unknown[] = []
      for (const url of ['fabric://chat?project=p-site', 'fabric://chat?service=atlas-agent.default', 'fabric://session/new?project=atlas']) {
        expect(await resolveLink(url, { ...ok, ...broken, failed: (e) => failed.push(e) })).toEqual({ route: { kind: 'home' }, notice: 'link-unreadable' })
      }
      expect(failed).toHaveLength(3)
    })
  it('a link Fabric refuses is refused without reading anything', async () => {
    let reads = 0
    const counting = { ...ok, projects: async () => { reads++; return [] }, failed: () => {} }
    expect(await resolveLink('fabric://chat?service=x&prompt=rm', counting)).toEqual({ route: { kind: 'home' }, notice: 'link-refused' })
    expect(reads).toBe(0)
  })
})

// 0.3.5 review ER-2: a link that arrives with no window (macOS after the last window closed, a `--background` launch,
// a second instance on Windows/Linux) opens one, the way the consent presenter does; it waits for it, then opens.
describe('linkWindowPlan', () => {
  it('before startup has finished, the link waits (startup opens the window and then the link)', () => {
    expect(linkWindowPlan({ startupDone: false, hasWindow: false })).toBe('hold')
    expect(linkWindowPlan({ startupDone: false, hasWindow: true })).toBe('hold')
  })
  it('with no window, it waits for the one it opens', () => {
    expect(linkWindowPlan({ startupDone: true, hasWindow: false })).toBe('hold-and-open-window')
  })
  it('with a window, it opens', () => {
    expect(linkWindowPlan({ startupDone: true, hasWindow: true })).toBe('open')
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('the main process opens links through these two (ER-1, ER-2)', () => {
  const src = readFileSync(path.join(__dirname, '..', 'main', 'index.ts'), 'utf8')
  const region = src.slice(src.indexOf('// #region fabric-link-handler'), src.indexOf('// #endregion fabric-link-handler'))
  it('reads through resolveLink, with the projects read throwing on its error', () => {
    expect(region).toMatch(/await resolveLink\(url, \{/)
    expect(region).toMatch(/if \(error\) throw new Error\(`the projects could not be read/)
    expect(region).not.toMatch(/routeForLink\(/)
  })
  it('a link that finds no window opens one; a second instance with none open opens one', () => {
    expect(region).toMatch(/if \(plan === 'hold-and-open-window'\) createWindow\(\)/)
    const at = src.indexOf("app.on('second-instance'")
    const second = src.slice(at, src.indexOf('app.whenReady()', at))
    expect(second).toMatch(/else if \(linkStartupDone && !process\.env\.SMOKE\) createWindow\(\)/)
    expect(src).toMatch(/linksStartupDone\(\)\n.*\n\s*if \(!BACKGROUND_LAUNCH \|\| activatedDuringStartup \|\| pendingLinks\.size > 0\) createWindow\(\)/)
  })
  it('a ninth waiting link is never dropped in silence: the hold and the outbox report it and the window is told (0.3.5 review i2 ER-7)', () => {
    expect(region).not.toMatch(/pendingLinks\.length < 8/)
    // Every link that is not opened at once is held — the hold, not a condition here, decides what is dropped.
    expect(region).toMatch(/if \(plan === 'open'\) \{ void openLink\(url\); return \}\n\s*pendingLinks\.hold\(url\)\n/)
    expect(region).toMatch(/const pendingLinks = createLinkHold<string>\(8, \(\) => linkDropped\('before-window'\)\)/)
    expect(region).toMatch(/onDrop: \(\) => linkDropped\('before-page'\)/)
    expect(region).toMatch(/op: 'link\.dropped'/)
    expect(region).toMatch(/openLink\(url, i === links\.length - 1 \? dropped : 0\)/)
  })
})
