// The renderer's test harness (M117, and the first half of M110).
//
// Before this file the renderer had NO seam: 3 000 lines of TSX, zero tests, and
// `pnpm test` printed success having asserted nothing about any of it. The
// component set is the first thing that can be tested in isolation, so it is
// where the harness starts rather than where it ends.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// RUN THIS FROM `apps/desktop`, or through `pnpm test` / `scripts/ci.sh` at the
// root. Running bare `vitest` from the REPOSITORY root picks up no config —
// vitest is a dependency of this package, not of the root — so it scans with
// its defaults, without jsdom, and four component tests fail for want of a DOM.
// The tests are fine and the invocation is wrong, and it looked real enough to
// send me investigating twice in one run.
//
// A root config was tried and removed: it needs vitest in the root's
// dependencies, which is a real dependency added to fix a mistyped command, and
// a second copy free to drift from this one.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // See the file: Monaco probes for a jsdom gap at IMPORT time, so the fix
    // has to land before any spec's first line.
    setupFiles: ['./test/jsdom-gaps.ts'],
    // `src/shared` is here because the ladder is asked by BOTH the renderer
    // and the main process, and a rule enforced in two places is tested where
    // it lives rather than twice at its call sites.
    include: ['src/renderer/**/*.test.tsx', 'src/renderer/**/*.test.ts', 'src/shared/**/*.test.ts'],
    globals: false,
    restoreMocks: true
  }
})
