import { describe, expect, it } from 'vitest'
import { disambiguate, humaniseSlug, projectDisplayName, repoKey, resolveDisplayName, type DescriptorName } from './projectDisplayName'

const d = (id: string, instance: string | null, name: string, repository: string | null = null): DescriptorName => ({ id, instance, name, repository })

describe('projectDisplayName', () => {
  it('prints the stored name when nothing else is known, so a caller that passes only a name is unchanged', () => {
    expect(projectDisplayName({ name: 'copylot-agent' })).toBe('copylot-agent')
  })
  it('prefers the row\'s resolved name, then the map by id', () => {
    expect(projectDisplayName({ id: 'p1', name: 'copylot-agent', displayName: 'Copylot' })).toBe('Copylot')
    expect(projectDisplayName({ id: 'p1', name: 'copylot-agent' }, { p1: { name: 'Copylot', from: 'descriptor', derived: false } })).toBe('Copylot')
    expect(projectDisplayName({ id: 'p2', name: 'x' }, { p1: { name: 'Copylot', from: 'descriptor', derived: false } })).toBe('x')
  })
})

describe('resolveDisplayName (rail gap §2)', () => {
  const descriptors = [
    d('copylot-agent', 'cloud', 'Copylot (облако)', 'https://github.com/ssheleg/copylot-agent'),
    d('copylot-agent', 'default', 'Copylot', 'https://github.com/ssheleg/copylot-agent'),
    d('research-agent', 'main', 'Research Agent'),
    d('company-assessment', 'default', 'Company assessment', 'https://github.com/ssheleg/company-assessment-agent.git')
  ]
  it('a descriptor whose id is the folder name, the default instance first', () => {
    expect(resolveDisplayName({ name: 'copylot-agent', folders: ['copylot-agent'] }, descriptors)).toEqual({ name: 'Copylot', from: 'descriptor', derived: false, via: 'own' })
  })
  it('a descriptor whose repository is one of the project\'s remotes', () => {
    expect(resolveDisplayName({ name: 'company-assessment-agent', remotes: ['github.com/ssheleg/company-assessment-agent'] }, descriptors).name).toBe('Company assessment')
  })
  it('otherwise the slug, humanised and marked derived', () => {
    expect(resolveDisplayName({ name: 'agent-stack' }, descriptors)).toEqual({ name: 'Agent Stack', from: 'slug', derived: true })
  })
  it('CO-481: the project\'s own descriptor wins over a sibling repository\'s, and a remote over a sibling folder', () => {
    const many = [...descriptors, d('frame-agent', 'default', 'Frame Agent', 'https://github.com/ssheleg/frame-agent')]
    expect(resolveDisplayName({ name: 'research-agent', folders: ['frame-agent', 'research-agent'] }, many)).toMatchObject({ name: 'Research Agent', via: 'own' })
    expect(resolveDisplayName({ name: 'studio', folders: ['frame-agent'], remotes: ['github.com/ssheleg/copylot-agent'] }, many)).toMatchObject({ name: 'Copylot', via: 'repository' })
    expect(resolveDisplayName({ name: 'studio', folders: ['frame-agent'] }, many)).toMatchObject({ name: 'Frame Agent', via: 'folder' })
  })
  it('a display name of the project itself wins', () => {
    expect(resolveDisplayName({ name: 'copylot-agent', displayName: 'Copylot Studio' }, descriptors)).toEqual({ name: 'Copylot Studio', from: 'project', derived: false })
  })
})

describe('repoKey and humaniseSlug', () => {
  it('reduces every way of writing a repository to host/owner/name', () => {
    for (const u of ['https://github.com/ssheleg/x', 'https://github.com/ssheleg/x.git', 'git@github.com:ssheleg/x.git', 'github.com/ssheleg/x/', 'HTTPS://GitHub.com/ssheleg/X'])
      expect(repoKey(u)).toBe('github.com/ssheleg/x')
    expect(repoKey('')).toBeNull()
  })
  it('splits and capitalises', () => {
    expect(humaniseSlug('research-agent')).toBe('Research Agent')
    expect(humaniseSlug('sshlg_growth.reader')).toBe('Sshlg Growth Reader')
  })
})

describe('disambiguate (CO-481)', () => {
  const r = (name: string, via?: 'own' | 'repository' | 'folder') => ({ name, from: 'descriptor' as const, derived: false, ...(via ? { via } : {}) })
  it('the project owning the name keeps it, the other carries its slug', () => {
    const out = disambiguate({ a: r('Research Agent', 'own'), b: r('Research Agent', 'folder'), c: r('Copylot', 'own') }, { a: 'research-agent', b: 'research-lab', c: 'copylot-agent' })
    expect(out.a.name).toBe('Research Agent')
    expect(out.b.name).toBe('Research Agent (research-lab)')
    expect(out.c.name).toBe('Copylot')
  })
  it('with no owner, or two, every one of them carries its slug; names differing only in case collide', () => {
    const out = disambiguate({ a: r('Studio', 'repository'), b: r('studio', 'folder') }, { a: 'studio-web', b: 'studio-app' })
    expect([out.a.name, out.b.name]).toEqual(['Studio (studio-web)', 'studio (studio-app)'])
  })
})
