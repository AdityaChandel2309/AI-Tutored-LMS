/**
 * Wrapper to run the course-draft-status property test and capture output.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runCourseDraftStatusProperty } from './course-draft-status.property';

const outputPath = path.resolve(__dirname, 'draft-status-output.txt');

async function main() {
  try {
    fs.writeFileSync(outputPath, 'Starting property test...\n');
    const result = await runCourseDraftStatusProperty(3);
    const output = JSON.stringify(result, null, 2);
    fs.writeFileSync(outputPath, output + '\n');
    console.log(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    fs.writeFileSync(outputPath, `ERROR: ${message}\n`);
    console.error(`ERROR: ${message}`);
  }
}

main();
