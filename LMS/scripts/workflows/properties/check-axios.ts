import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.resolve(__dirname, 'test-output.txt');

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require('axios');
  fs.writeFileSync(outputPath, `axios found: ${typeof axios}\n`);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  fs.writeFileSync(outputPath, `axios ERROR: ${message}\n`);
}
