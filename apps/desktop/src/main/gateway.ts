// What the machine's agentgateway offers this session (M127).
//
// Reading it here rather than at start-up is deliberate: a gateway started after
// the app was is a gateway a session can still use, and a gateway that stopped
// should refuse rather than hand out a URL that no longer answers.
//
// The KEY is not read from the gateway's files. It comes from the environment
// Fabric was launched in and is never stored: a key in the database is a key in
// every backup of it, and reading one out of another agent's configuration to
// borrow it is exactly the move this product refuses elsewhere.

import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseGatewayConfig, type GatewayFacts } from '../shared/servers.ts'

const ABSENT: GatewayFacts = { origin: null, routes: {}, key: null }

export function readGateway(
  configPath = path.join(os.homedir(), '.config', 'agentgateway', 'config.yaml'),
  env: NodeJS.ProcessEnv = process.env
): GatewayFacts {
  let text: string
  try {
    text = readFileSync(configPath, 'utf8')
  } catch {
    // No gateway on this machine, or none this user can read. Absent, and the
    // planner turns that into a named refusal rather than a silent omission.
    return ABSENT
  }
  const facts = parseGatewayConfig(text)
  return { ...facts, key: env.FABRIC_AGW_KEY?.trim() || null }
}
