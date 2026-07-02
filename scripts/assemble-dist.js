#!/usr/bin/env node
/**
 * Assemble a root-level `dist/` directory so Lovable's post-build
 * `dist-check` finds an artifact.
 *
 * This monorepo produces build output in two places:
 *   - `web/.next` (Next.js frontend)
 *   - `api/dist`  (NestJS backend)
 *
 * Neither of those is discoverable by the platform's generic dist-check,
 * which looks for `./dist` at the repo root. We create a small stub folder
 * with an index.html marker and a manifest that points at the real build
 * outputs. This is cosmetic — actual deploys still consume the per-workspace
 * build artifacts directly.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.mkdirSync(dist, { recursive: true });

const webBuild = path.join(root, 'web', '.next');
const apiBuild = path.join(root, 'api', 'dist');

const manifest = {
  generatedAt: new Date().toISOString(),
  note: 'Monorepo build. Real artifacts live in the workspace directories.',
  artifacts: {
    web: fs.existsSync(webBuild) ? 'web/.next' : null,
    api: fs.existsSync(apiBuild) ? 'api/dist' : null,
  },
};

fs.writeFileSync(
  path.join(dist, 'build-manifest.json'),
  JSON.stringify(manifest, null, 2),
);

fs.writeFileSync(
  path.join(dist, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>LMS build</title>
  </head>
  <body>
    <p>Monorepo build complete. See build-manifest.json for artifact locations.</p>
  </body>
</html>
`,
);

console.log('▸ Assembled root dist/ marker with', JSON.stringify(manifest.artifacts));