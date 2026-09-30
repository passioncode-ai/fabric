// A product module and every relative module it imports, as one data: URL a
// browser can import. Browser suites load mockup modules without a server, and
// inlining only the module itself broke silently each time a module gained an
// import (CO-171): the import failed inside the page and the suite timed out.
import {readFileSync} from 'node:fs'
import path from 'node:path'

const cache = new Map()
export function moduleURL(file, root) {
  const absolute = path.resolve(root, file)
  if (cache.has(absolute)) return cache.get(absolute)
  const source = readFileSync(absolute, 'utf8').replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g, (whole, quote, spec) =>
    `from ${JSON.stringify(moduleURL(path.join(path.dirname(absolute), spec), root))}`)
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
  cache.set(absolute, url)
  return url
}
