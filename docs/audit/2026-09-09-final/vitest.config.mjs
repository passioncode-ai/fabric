import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const desktop = resolve(process.env.FABRIC_AUDIT_DESKTOP || process.cwd());
const require = createRequire(join(desktop, 'package.json'));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const artifactDir = dirname(fileURLToPath(import.meta.url));
export default {
  root: artifactDir,
  plugins: [react()],
  resolve: { dedupe: ['react','react-dom'], alias: {
    '@fabric-desktop': desktop,
    react: dirname(require.resolve('react/package.json')),
    'react-dom': dirname(require.resolve('react-dom/package.json')),
    vitest: join(dirname(require.resolve('vitest/package.json')), 'dist/index.js'),
    '@testing-library/react': require.resolve('@testing-library/react')
  }},
  test: { environment: 'jsdom', include: [join(artifactDir, 'reader-probes.test.tsx')], setupFiles: [join(desktop, 'test/jsdom-gaps.ts')] }
};
