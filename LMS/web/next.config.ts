import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

// Dynamically find the root that contains node_modules/next. This works both
// in the local monorepo (next hoisted to LMS/node_modules/next) and inside
// Docker (next in /app/node_modules/next).
const require_ = createRequire(import.meta.url);
const nextPkgPath = require_.resolve("next/package.json");
// nextPkgPath → …/node_modules/next/package.json
// Go up 3 levels: package.json → next/ → node_modules/ → root
const monorepoRoot = path.resolve(nextPkgPath, "../../..");

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      next: path.dirname(nextPkgPath),
    },
  },
};

export default nextConfig;
