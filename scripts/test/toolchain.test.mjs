import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sha256 } from '../lib/build-identity.mjs'
import { verifyToolchain, validToolchainPin } from '../lib/toolchain.mjs'
const source = path.resolve(import.meta.dirname, '../..')
const pin = JSON.parse(readFileSync(path.join(source, 'toolchain.lock.json')))
const observed = p => ({ host: p.host, node: p.node, pnpm: p.pnpm, packageManager: `pnpm@${p.pnpm}`,
  electronRuntimeVersion: p.packages.electron, entrypoints: Object.fromEntries(['electron','electron-builder','electron-vite','vite','typescript','@electron/rebuild'].map(n=>[n,true])),
  lockfileSha256: p.lockfileSha256, installedLockfileSha256: p.lockfileSha256, packages: p.packages })
const fixture = () => mkdtempSync(path.join(os.tmpdir(), 'fabric-toolchain-'))
const put = (root, name, body, mode) => { const dest=path.join(root,name);mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,body,{mode}) }
const save = (root, value) => put(root, 'toolchain.lock.json', JSON.stringify(value))

test('a checksum of arbitrary JSON, incomplete pins, ranges and wrong field types never verify',()=>{
  const root=fixture()
  try {
    assert.equal(verifyToolchain(root,observed(pin)).digest,null)
    for(const invalid of [{},[],null,{...pin,node:'^26.8.2'},{...pin,node:['26.8.2']},
      {...pin,pnpm:null},{...pin,packages:{}},{...pin,host:{platform:'darwin'}},{...pin,extra:true}]){
      save(root,invalid);assert.equal(validToolchainPin(invalid),false)
      assert.deepEqual(verifyToolchain(root,observed(pin)).reasons,['pin_invalid'])
      assert.equal(verifyToolchain(root,observed(pin)).digest,null)
    }
  } finally { rmSync(root,{recursive:true,force:true}) }
})
test('matching host and installed versions verify; every mismatched or absent input removes the digest',()=>{
  const root=fixture();save(root,pin)
  try {
    assert.equal(verifyToolchain(root,observed(pin)).status,'verified')
    const bad=[{host:{...pin.host,arch:'x64'}},{host:{...pin.host,release:'other'}},{node:'24.0.0'},
      {pnpm:null},{pnpm:'12.4.1'},{packageManager:'pnpm@latest'},{lockfileSha256:'0'.repeat(64)},
      {installedLockfileSha256:null},{entrypoints:{}},{electronRuntimeVersion:null},{packages:{...pin.packages,electron:'43.0.0'}},{packages:{}}]
    for(const delta of bad){const r=verifyToolchain(root,{...observed(pin),...delta});assert.equal(r.status,'unverified');assert.equal(r.digest,null);assert.ok(r.reasons.length)}
  } finally { rmSync(root,{recursive:true,force:true}) }
})

test('real CLI and manifest fail strict on unavailable/wrong tools; package wrapper never starts work after refusal',()=>{
  const root=fixture()
  try {
    for(const f of ['scripts/check-toolchain.mjs','scripts/package-pinned.mjs','scripts/build-manifest.mjs','scripts/lib/toolchain.mjs','scripts/lib/build-identity.mjs']){
      mkdirSync(path.dirname(path.join(root,f)),{recursive:true});cpSync(path.join(source,f),path.join(root,f))
    }
    const locked='fixture dependency lock\n',p={...pin,host:{platform:process.platform,arch:process.arch,release:os.release()},node:process.versions.node,lockfileSha256:sha256(locked)}
    save(root,p);put(root,'pnpm-lock.yaml',locked);put(root,'node_modules/.pnpm/lock.yaml',locked)
    put(root,'package.json',JSON.stringify({packageManager:`pnpm@${p.pnpm}`}))
    put(root,'apps/desktop/package.json',JSON.stringify({version:'0.1.0'}))
    for(let i=1;i<=63;i++)put(root,`supabase/migrations/${String(i).padStart(5,'0')}.sql`,'-- fixture')
    const contract={schema:'FabricSchemaContract@1',minimum:63,maximum:63}
    put(root,'apps/desktop/src/shared/schemaContract.json',JSON.stringify(contract))
    for(const [name,version] of Object.entries(p.packages))put(root,`apps/desktop/node_modules/${name}/package.json`,JSON.stringify({version}))
    for(const [name,entry] of Object.entries({electron:'cli.js','electron-builder':'cli.js','electron-vite':'bin/electron-vite.js',vite:'bin/vite.js',typescript:'bin/tsc','@electron/rebuild':'lib/cli.js'}))put(root,`apps/desktop/node_modules/${name}/${entry}`,'// fixture')
    put(root,'apps/desktop/node_modules/electron/dist/version',p.packages.electron)
    const executable=path.join(root,'fixture-pnpm')
    put(root,'fixture-pnpm',`#!${process.execPath}\nif(process.argv[2]==='--version') console.log('${p.pnpm}');else {if(process.env.FABRIC_REQUIRE_TOOLCHAIN!=='1'||process.env.pnpm_config_verify_deps_before_run!=='error')process.exit(9);require('fs').writeFileSync(${JSON.stringify(path.join(root,'unexpected-package'))},'called');}\n`,0o700)
    const env={...process.env,FABRIC_PNPM_EXECUTABLE:executable}
    const run=(file,args=[],extra={})=>spawnSync(process.execPath,[file,...args],{cwd:root,env:{...env,...extra},encoding:'utf8'})
    let r=run('scripts/check-toolchain.mjs');assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'verified')
    r=run('scripts/build-manifest.mjs',['good.json'],{FABRIC_REQUIRE_TOOLCHAIN:'1'});assert.equal(r.status,0,r.stderr)
    const good=JSON.parse(readFileSync(path.join(root,'good.json')))
    assert.equal(good.toolchainVerification.status,'verified');assert.equal(good.toolchainVerification.scope,'desktop-bundle-and-packager-versions')
    assert.equal(good.schemaMin,63);assert.equal(good.schemaMax,63)
    for(const bad of [{...contract,maximum:64},{...contract,minimum:64},{...contract,minimum:'63'},{}]){
      put(root,'apps/desktop/src/shared/schemaContract.json',JSON.stringify(bad))
      r=run('scripts/build-manifest.mjs',['bad-schema.json']);assert.notEqual(r.status,0);assert.equal(existsSync(path.join(root,'bad-schema.json')),false)
    }
    put(root,'apps/desktop/src/shared/schemaContract.json',JSON.stringify(contract))
    put(root,'supabase/migrations/00064.sql','-- unqualified fixture')
    r=run('scripts/build-manifest.mjs',['new-schema.json']);assert.notEqual(r.status,0);assert.equal(existsSync(path.join(root,'new-schema.json')),false)
    rmSync(path.join(root,'supabase/migrations/00064.sql'))
    for(const missing of [path.join(root,'no-such-pnpm')]){
      r=run('scripts/check-toolchain.mjs',[],{FABRIC_PNPM_EXECUTABLE:missing});assert.equal(r.status,1)
      r=run('scripts/build-manifest.mjs',['denied.json'],{FABRIC_PNPM_EXECUTABLE:missing,FABRIC_REQUIRE_TOOLCHAIN:'1'});assert.equal(r.status,1);assert.equal(existsSync(path.join(root,'denied.json')),false)
      r=run('scripts/package-pinned.mjs',[],{FABRIC_PNPM_EXECUTABLE:missing});assert.equal(r.status,1)
    }
    r=run('scripts/package-pinned.mjs');assert.equal(r.status,0,r.stderr)
    assert.equal(existsSync(path.join(root,'unexpected-package')),true);rmSync(path.join(root,'unexpected-package'))
    put(root,'node_modules/.pnpm/lock.yaml','changed installed lock')
    r=run('scripts/package-pinned.mjs');assert.equal(r.status,1);assert.equal(existsSync(path.join(root,'unexpected-package')),false)
    put(root,'node_modules/.pnpm/lock.yaml',locked)
    rmSync(path.join(root,'apps/desktop/node_modules/electron-vite/bin/electron-vite.js'))
    r=run('scripts/package-pinned.mjs');assert.equal(r.status,1);assert.equal(existsSync(path.join(root,'unexpected-package')),false)
    put(root,'apps/desktop/node_modules/electron-vite/bin/electron-vite.js','// fixture')
    save(root,{...p,host:{...p.host,release:'wrong-host'}})
    r=run('scripts/package-pinned.mjs');assert.equal(r.status,1);assert.equal(existsSync(path.join(root,'unexpected-package')),false)
    r=run('scripts/build-manifest.mjs',['dev.json']);assert.equal(r.status,0)
    const dev=JSON.parse(readFileSync(path.join(root,'dev.json')));assert.equal(dev.toolchainDigest,null);assert.equal(dev.toolchainVerification.status,'unverified')
    save(root,{});r=run('scripts/build-manifest.mjs',['arbitrary.json']);assert.equal(r.status,0)
    assert.equal(JSON.parse(readFileSync(path.join(root,'arbitrary.json'))).toolchainDigest,null)
  } finally { rmSync(root,{recursive:true,force:true}) }
})
