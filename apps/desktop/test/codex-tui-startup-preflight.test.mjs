// Manual T3 prerequisite, NOT native TUI acceptance. This program can invoke
// only --version, --help, and agents --help; it never connects or opens a TUI.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'

const commit = '36650394c5b38c2990ccf2a3457165ca3e9d9726'
const sources = {
  'codex-rs/cli/src/main.rs': '88fd769091e831d50b99f8b5b573424c86a2323665a840461b191d62f47bb817',
  'codex-rs/tui/src/lib.rs': 'a484733816861e7740fc99b1d518dfd66554fa88cd8ba486358c919c90b80839',
  'codex-rs/tui/src/cli.rs': '991791014d57197ec734d743d15bf2aff6f04e161e60ad9c2c07ac5f97cc1a55',
  'codex-rs/tui/src/app/startup.rs': '4bd30ed7af11ba470e2dd1fc71a2ebb4d4a13b4d548d6a2f779df60594b98fef',
  'codex-rs/tui/src/app_server_session.rs': 'a90b5102fe109ad3f456814d7ffaf2e6b84f8a744ddf76622a9a2895201a9969',
  'codex-rs/app-server-client/src/remote.rs': '0059b011b8163c91944e75f71b89f366f4e9f3200b1d3736b869a94b3c2a9e73'
}
const sourceRoot = process.env.FABRIC_CODEX_TUI_SOURCE_DIR ?? '/tmp/fabric-codex-tui-preflight-01571-source'
const binary = process.env.FABRIC_CODEX_BIN ?? '/opt/homebrew/bin/codex'
const hash = value => createHash('sha256').update(value).digest('hex')
class Failure extends Error { constructor(code) { super(code); this.code = code } }
const check = (condition, code) => { if (!condition) throw new Failure(code) }
let root = null, stage = 'prerequisites'
try {
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec') || !existsSync(binary)) {
    console.log(JSON.stringify({ status:'NOT_RUN', preflight:'NOT_RUN', reason:'requires_macos_sandbox_and_installed_codex', tuiProbe:'NOT_RUN' }))
    process.exitCode = 2
  } else if (!existsSync(path.join(sourceRoot,'commit'))) {
    console.log(JSON.stringify({ status:'NOT_RUN', preflight:'NOT_RUN', reason:'pinned_source_snapshot_missing', tuiProbe:'NOT_RUN' }))
    process.exitCode = 2
  } else {
    stage = 'source_integrity'
    check(readFileSync(path.join(sourceRoot,'commit'),'utf8').trim() === commit, 'source_commit_mismatch')
    for (const [name, expected] of Object.entries(sources)) {
      const file = path.join(sourceRoot,name)
      check(statSync(file).size <= 2_000_000, 'source_file_bound')
      check(hash(readFileSync(file)) === expected, 'source_digest_mismatch')
    }
    stage = 'owned_help'
    root = realpathSync(mkdtempSync(path.join(tmpdir(),'fabric-codex-tui-preflight-')))
    const profile = path.join(root,'profile'); mkdirSync(profile,{mode:0o700})
    const sandbox = path.join(root,'help.sb')
    // Stronger than a connected TUI: no network exceptions, no operator-home
    // reads, no writes outside this owned fixture. No auth/token is supplied.
    writeFileSync(sandbox,[
      '(version 1)','(allow default)','(deny network*)','(deny file-write*)',
      `(allow file-write* (subpath ${JSON.stringify(root)}))`,
      `(deny file-read* (subpath ${JSON.stringify(homedir())}))`,
      '(deny mach-lookup (global-name "com.apple.securityd"))'
    ].join('\n'),{mode:0o600})
    const allowedCommands = new Map([
      ['version',['--version']],['help',['--help']],['agentsHelp',['agents','--help']]
    ])
    const outputs = {}
    for (const [name,args] of allowedCommands) {
      outputs[name] = execFileSync('/usr/bin/sandbox-exec',['-f',sandbox,binary,...args],{
        cwd:root,env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',CODEX_HOME:profile,TMPDIR:root,NO_COLOR:'1'},
        encoding:'utf8',timeout:5000,maxBuffer:262144,stdio:['ignore','pipe','pipe']
      }).trim()
    }
    check(outputs.version === 'codex-cli 0.157.1','unreviewed_installed_build')
    check(outputs.help.includes('--remote <ADDR>') && outputs.help.includes('--remote-auth-token-env <ENV_VAR>'),'root_remote_flags_missing')
    check(outputs.agentsHelp.includes('--remote <ADDR>') && outputs.agentsHelp.includes('--remote-auth-token-env <ENV_VAR>'),'agents_remote_flags_missing')
    check(outputs.agentsHelp.includes('--no-alt-screen'),'agents_terminal_flag_missing')
    check(!outputs.agentsHelp.includes('[PROMPT]'),'agents_prompt_contract_changed')
    const receipt = {
      status:'NOT_RUN',preflight:'PASS',reason:'tui_wire_method_gate_required',tuiProbe:'NOT_RUN',
      build:outputs.version,sourceCommit:commit,sourceFilesVerified:Object.keys(sources),
      helpSha256:{root:hash(outputs.help),agents:hash(outputs.agentsHelp)},
      rootRemoteFlags:true,agentsRemoteFlags:true,agentsNoAltScreen:true,
      executedCliCommands:[...allowedCommands.values()],
      tuiProcessesStarted:0,backendProcessesStarted:0,networkConnectionsOpened:0,
      tuiObservedMethods:null,tuiTurnRequests:null,tuiModelInferenceRequests:null,
      realAccountUsed:false,privateProfileCopied:false
    }
    rmSync(root,{recursive:true,force:true});root=null
    console.log(JSON.stringify({...receipt,ownedFixtureRemoved:true}))
    // A successful prerequisite must never make a NOT_RUN native capability green.
    process.exitCode = 2
  }
} catch (error) {
  console.error(JSON.stringify({status:'FAIL',preflight:'FAIL',stage,
    reason:error instanceof Failure?error.code:'preflight_operation_failed',tuiProbe:'NOT_RUN'}))
  process.exitCode = 1
} finally {
  if (root !== null) {
    try { rmSync(root,{recursive:true,force:true}) }
    catch { console.error(JSON.stringify({status:'FAIL',reason:'owned_fixture_cleanup_failed'}));process.exitCode=1 }
  }
}
