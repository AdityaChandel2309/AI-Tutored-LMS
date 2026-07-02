/**
 * Wrapper to run the course-creation-draft property test and capture output to a file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runCourseCreationDraftProperty } from './course-creation-draft.property.js';

const outputPath = path.resolve(__dirname, 'test-output.txt');

async function main() {
  try {
    fs.writeFileSync(outputPath, 'Starting property test...\n');
    const result = await runCourseCreationDraftProperty(5);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    fs.writeFileSync(outputPath, `ERROR: ${message}\n`);
  }
}

main();
