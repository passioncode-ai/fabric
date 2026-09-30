#!/usr/bin/env node
// Two actual clean out/ builds in ONE checkout, not two clean installations or
// signed-package reproduction. Dependency installation is deliberately absent.
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { collectArtifactFiles, artifactDigest, ARTIFACT_ABSENT } from './lib/build-identity.mjs'
import { verifyToolchain } from './lib/toolchain.mjs'
const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'apps/desktop/out')
const receipts = []
for (let i = 0; i < 2; i++) {
  const before = verifyToolchain(root)
  if (before.status !== 'verified') throw new Error(`Toolchain unverified: ${before.reasons.join(', ')}`)
  rmSync(out, { recursive: true, force: true })
  execFileSync(process.execPath, [path.join(root, 'apps/desktop/node_modules/electron-vite/bin/electron-vite.js'), 'build'], {
    cwd: path.join(root, 'apps/desktop'), stdio: 'inherit', env: { ...process.env, COREPACK_ENABLE_NETWORK: '0', npm_config_manage_package_manager_versions: 'false' }
  })
  const after = verifyToolchain(root)
  if (after.status !== 'verified' || after.digest !== before.digest) throw new Error('Toolchain changed during build')
  const files = collectArtifactFiles(out), digest = artifactDigest(files)
  if (digest === ARTIFACT_ABSENT) throw new Error('Build produced no measurable bundle')
  receipts.push({ files, digest, toolchainDigest: after.digest })
}
const same = JSON.stringify(receipts[0]) === JSON.stringify(receipts[1])
console.log(JSON.stringify({
  status: same ? 'MATCHED' : 'DIFFERENT', scope: 'two-clean-output-builds-one-checkout-one-installed-dependency-tree',
  builds: receipts.map(({ digest, toolchainDigest, files }) => ({ digest, toolchainDigest, files: files.length })),
  differingPaths: [...new Set(receipts.flatMap(r => r.files.map(f => f.relativePath)))].filter(p =>
    JSON.stringify(receipts[0].files.find(f => f.relativePath === p)) !== JSON.stringify(receipts[1].files.find(f => f.relativePath === p))),
  cleanInstallReproduction: 'not_checked', nativePackageReproduction: 'not_checked', signing: 'not_checked'
}))
if (!same) process.exitCode = 1
