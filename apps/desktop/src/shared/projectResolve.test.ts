// F9, ADR-0166 §1, DEC-0089: Fabric answers `fabric.project.resolve` with the contract's own rule set. The vendored
// files are the contract's bytes at the pinned commit, every attribution vector passes through them, and the snapshot
// Fabric builds from its own state (admitted folders, their Git facts, tombstones, temp roots) is what the rules read.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { attributeFolder } from './contract/folder-attribution/folder-attribution'
import { contractPath, folderSnapshot, resolveProject, type ResolveDeps } from './projectResolve'

const root = path.resolve(__dirname, '../..')
const pin = JSON.parse(readFileSync(path.join(root, 'src/shared/contract/folder-attribution/pin.json'), 'utf8')) as {
  commit: string; files: { path: string; vendored: string; sha256: string }[]
}

describe('the vendored folder attribution (DEC-0089)', () => {
  it('is the contract bytes at the pinned commit, unedited', () => {
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/)
    for (const f of pin.files) {
      const bytes = readFileSync(path.join(root, f.vendored))
      expect(createHash('sha256').update(bytes).digest('hex'), f.vendored).toBe(f.sha256)
    }
  })

  it('answers every attribution vector of the contract as the contract expects', () => {
    const vectors = JSON.parse(readFileSync(path.join(root, 'test/fixtures/folder-attribution/vectors.json'), 'utf8')) as {
      attribution: { name: string; snapshot: unknown; expected: unknown }[]
    }
    expect(vectors.attribution.length).toBeGreaterThan(100)
    for (const v of vectors.attribution) expect(attributeFolder(v.snapshot), v.name).toEqual(v.expected)
  })
})

function deps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  const git: Record<string, { toplevel: string; commonDir: string; origin: string | null } | null> = {
    '/Users/ana/DATA/fabric': { toplevel: '/Users/ana/DATA/fabric', commonDir: '/Users/ana/DATA/fabric/.git', origin: 'git@github.com:example-org/fabric.git' },
    '/Users/ana/DATA/fabric/apps': { toplevel: '/Users/ana/DATA/fabric', commonDir: '/Users/ana/DATA/fabric/.git', origin: 'git@github.com:example-org/fabric.git' },
    '/Users/ana/DATA/_worktrees/f9': { toplevel: '/Users/ana/DATA/_worktrees/f9', commonDir: '/Users/ana/DATA/fabric/.git', origin: 'git@github.com:example-org/fabric.git' },
    '/Users/ana/DATA/brand-new': { toplevel: '/Users/ana/DATA/brand-new', commonDir: '/Users/ana/DATA/brand-new/.git', origin: null },
    '/Users/ana/DATA/old': { toplevel: '/Users/ana/DATA/old', commonDir: '/Users/ana/DATA/old/.git', origin: null }
  }
  return {
    admitted: async () => [{ projectId: 'p-fabric', path: '/Users/ana/DATA/fabric', remoteKey: 'github.com/example-org/fabric', kind: 'primary' }],
    detached: async () => [{ path: '/Users/ana/DATA/old' }],
    realpath: (p) => (p.includes('missing') ? null : p),
    git: async (p) => git[p] ?? null,
    home: '/Users/ana',
    tempRoots: ['/tmp', '/private/tmp', '/private/var/folders', '/Users/ana/Library/Caches'],
    ...over
  }
}

describe('fabric.project.resolve over Fabric state', () => {
  it('builds the snapshot the rules read: folders with their Git facts, tombstones, temp roots', async () => {
    const s = await folderSnapshot('/Users/ana/DATA/fabric/apps', deps())
    expect(s).toMatchObject({
      folder: '/Users/ana/DATA/fabric/apps',
      home: '/Users/ana',
      git: { toplevel: '/Users/ana/DATA/fabric', commonDir: '/Users/ana/DATA/fabric/.git', mainCheckout: '/Users/ana/DATA/fabric', origin: 'git@github.com:example-org/fabric.git' },
      projects: [{ id: 'p-fabric', folders: [{ path: '/Users/ana/DATA/fabric', commonDir: '/Users/ana/DATA/fabric/.git', toplevel: '/Users/ana/DATA/fabric', origin: 'git@github.com:example-org/fabric.git' }] }],
      tombstones: ['/Users/ana/DATA/old']
    })
  })

  it('attaches a subfolder, a worktree and a known clone to their project; a new repository is new', async () => {
    expect(await resolveProject('/Users/ana/DATA/fabric/apps', deps())).toEqual({ outcome: 'attached', project: 'p-fabric', rule: 'folder' })
    expect(await resolveProject('/Users/ana/DATA/_worktrees/f9', deps())).toMatchObject({ outcome: 'attached', project: 'p-fabric' })
    expect(await resolveProject('/Users/ana/DATA/brand-new', deps())).toEqual({ outcome: 'new', root: '/Users/ana/DATA/brand-new' })
  })

  it('refuses a tombstoned folder and a temp folder, and says input-invalid for a relative or missing path', async () => {
    expect(await resolveProject('/Users/ana/DATA/old', deps())).toEqual({ outcome: 'refused', reason: 'tombstoned' })
    expect(await resolveProject('/private/tmp/x', deps({ git: async () => null }))).toEqual({ outcome: 'refused', reason: 'transient' })
    expect(await resolveProject('relative/folder', deps())).toEqual({ fault: 'input-invalid' })
    expect(await resolveProject('/Users/ana/missing', deps())).toEqual({ fault: 'input-invalid' })
    expect(await resolveProject(42 as unknown as string, deps())).toEqual({ fault: 'input-invalid' })
  })

  it('writes a Windows path in the contract form', () => {
    expect(contractPath('C:\\Users\\ana\\work', 'win32')).toBe('C:/Users/ana/work')
    expect(contractPath('c:\\Users\\ana\\', 'win32')).toBe('C:/Users/ana')
    expect(contractPath('/Users/ana/work/', 'darwin')).toBe('/Users/ana/work')
  })
})
