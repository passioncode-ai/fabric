// REQ-04 of the 0.3.3 onboarding (SCN-131, SCN-136): before an agent is created or adapted in a coding agent's
// console, Fabric says whether the Fabric Agent Adapter skills are where THAT agent reads skills. Planted homes.
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const { adapterSkills, skillVersion, INSTALL_COMMAND, ADAPTER_PLUGIN } = await import(path.resolve(import.meta.dirname, '../src/main/adapterSkills.ts'))

const md = (v) => `---\nname: x\nmetadata:\n  version: "${v}"\n---\n# x\n`
const skills = (dir, v = '0.8.0', which = ['creating-fabric-agents', 'adapting-projects-to-fabric']) => {
  for (const s of which) { mkdirSync(path.join(dir, s), { recursive: true }); writeFileSync(path.join(dir, s, 'SKILL.md'), md(v)) }
}
const home = () => realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-skills-')))

assert.equal(skillVersion(md('0.8.0')), '0.8.0')
assert.equal(skillVersion('# no front matter'), null)

{ // Claude Code: the enabled plugin, recorded with its install path and version.
  const h = home(), install = path.join(h, 'cache', 'adapter', '0.8.0')
  skills(path.join(install, 'skills'))
  mkdirSync(path.join(h, '.claude', 'plugins'), { recursive: true })
  writeFileSync(path.join(h, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [ADAPTER_PLUGIN]: true } }))
  writeFileSync(path.join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { [ADAPTER_PLUGIN]: [{ installPath: install, version: '0.8.0' }] } }))
  const v = await adapterSkills('claude-code', { home: h })
  assert.deepEqual([v.ready, v.where, v.version], [true, 'plugin', '0.8.0'])
  // The same plugin switched off is not "installed for Claude Code".
  writeFileSync(path.join(h, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [ADAPTER_PLUGIN]: false } }))
  assert.equal((await adapterSkills('claude-code', { home: h })).where, 'none', 'a disabled plugin does not count')
}

{ // An enabled plugin whose install path lacks one skill is not ready; a plain copy in ~/.claude/skills is.
  const h = home(), install = path.join(h, 'cache', 'adapter', '0.5.0')
  skills(path.join(install, 'skills'), '0.5.0', ['adapting-projects-to-fabric'])
  mkdirSync(path.join(h, '.claude', 'plugins'), { recursive: true })
  writeFileSync(path.join(h, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [ADAPTER_PLUGIN]: true } }))
  writeFileSync(path.join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { [ADAPTER_PLUGIN]: [{ installPath: install }] } }))
  assert.equal((await adapterSkills('claude-code', { home: h })).ready, false, 'half a skill set is not ready')
  skills(path.join(h, '.claude', 'skills'), '0.7.0')
  const v = await adapterSkills('claude-code', { home: h })
  assert.deepEqual([v.ready, v.where, v.version], [true, 'agent-folder', '0.7.0'])
}

{ // Codex: its own folder counts; the shared folder alone is said as shared and not called ready.
  const h = home()
  skills(path.join(h, '.agents', 'skills'))
  const shared = await adapterSkills('codex', { home: h })
  assert.deepEqual([shared.ready, shared.where], [false, 'shared'], 'found only in the shared folder: not claimed as read by the agent')
  skills(path.join(h, '.codex', 'skills'))
  assert.deepEqual([(await adapterSkills('codex', { home: h })).ready, (await adapterSkills('codex', { home: h })).where], [true, 'agent-folder'])
}

{ // Nothing anywhere: not ready, and the install command is always there to copy.
  const v = await adapterSkills('hermes', { home: home() })
  assert.deepEqual([v.ready, v.where, v.version], [false, 'none', null])
  assert.equal(v.command, INSTALL_COMMAND)
  assert.equal(INSTALL_COMMAND, 'npx @passioncode-ai/passioncode@latest update')
}

{ // An unknown agent has no folder of its own: only the shared folder is looked at.
  const h = home(); skills(path.join(h, '.agents', 'skills'))
  assert.equal((await adapterSkills('some-new-agent', { home: h })).where, 'shared')
}

{ // Unreadable or malformed files are "not found", never a thrown error that blocks the screen.
  const h = home(); mkdirSync(path.join(h, '.claude'), { recursive: true }); writeFileSync(path.join(h, '.claude', 'settings.json'), '{ not json')
  assert.equal((await adapterSkills('claude-code', { home: h })).where, 'none')
}

{ // What the install command covers is said per agent (the launcher has no channel for Cline or Kimi Code).
  const h = home()
  for (const [id, covered] of [['claude-code', true], ['codex', true], ['kilo', true], ['hermes', true], ['cline', false], ['kimi-code', false]])
    assert.equal((await adapterSkills(id, { home: h })).launcherCovers, covered, id)
  // Cline has no folder of its own we know of: only the shared folder is looked at.
  skills(path.join(h, '.agents', 'skills'))
  assert.equal((await adapterSkills('cline', { home: h })).where, 'shared')
}

console.log('PASS adapter skills: launcher coverage per agent, Claude Code plugin (enabled, disabled, half), own folders, shared-only said as shared, none with the install command, unknown agent, malformed settings')
