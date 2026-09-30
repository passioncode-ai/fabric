#!/usr/bin/env node
// Explicit local-host packaging entry; generic development/CI stays separate.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { verifyToolchain } from './lib/toolchain.mjs'
const root = path.resolve(import.meta.dirname, '..')
const receipt = verifyToolchain(root)
if (receipt.status !== 'verified') {
  console.error(JSON.stringify(receipt))
  process.exit(1)
}
execFileSync(process.env.FABRIC_PNPM_EXECUTABLE || 'pnpm', ['--filter', '@fabric/desktop', 'package'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, FABRIC_REQUIRE_TOOLCHAIN: '1', COREPACK_ENABLE_NETWORK: '0', npm_config_manage_package_manager_versions: 'false', pnpm_config_verify_deps_before_run: 'error' }
})
