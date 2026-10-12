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
