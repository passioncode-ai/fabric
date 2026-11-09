// #region board-service-pack — docs: docs/launch/release-mac.md#universal-macos
// ADR-0192 (0.3.18): the board's service is a launch agent the Mac app ships at
// Contents/Library/LaunchAgents. electron-builder skips a missing `extraFiles` source with a warning only
// (app-builder-lib/out/fileMatcher.js), so without this check a release shipped no service and the app asked
// macOS to register one it does not have (the 0.3.18 review, iteration 1: PL-2, ER-1). afterPack refuses
// every packed macOS app, each architecture's and the joined one, whose property list is absent or names
// another job or program.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** The launch agent's file name: apps/desktop/src/shared/loginItem.ts#BOARD_SERVICE (a test keeps them equal). */
export const BOARD_SERVICE = 'ai.passioncode.desktop.board.plist'

/** What is wrong with the board's service in the packed `app` (a `.app` folder); empty when nothing is. */
export function boardServiceProblems(app) {
  const plist = path.join(app, 'Contents/Library/LaunchAgents', BOARD_SERVICE)
  if (!existsSync(plist)) return [`no ${path.relative(app, plist)}`]
  const text = readFileSync(plist, 'utf8')
  const value = (key) => text.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? null
  const problems = []
  const label = value('Label')
  if (label + '.plist' !== BOARD_SERVICE) problems.push(`Label is ${JSON.stringify(label)}, not ${JSON.stringify(BOARD_SERVICE.replace(/\.plist$/, ''))}`)
  const program = value('BundleProgram')
  if (!program) problems.push('no BundleProgram')
  else if (!existsSync(path.join(app, program))) problems.push(`BundleProgram ${program} is not in the app`)
  return problems
}
// #endregion board-service-pack
