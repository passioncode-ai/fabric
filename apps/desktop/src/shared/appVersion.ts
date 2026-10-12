import pkg from '../../package.json' with { type: 'json' }

/**
 * The app's version, from package.json — the one number the release commit changes (docs/launch/release-mac.md, step 1).
 * For code that runs outside Electron's `app` (fabric-mcp, a coding agent's child): a literal there said 0.4.0 in a
 * 0.3.5 build (0.3.5 verification, iteration 1, PL-5).
 */
export const APP_VERSION: string = pkg.version
