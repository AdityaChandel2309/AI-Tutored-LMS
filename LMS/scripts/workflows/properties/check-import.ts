import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';
import { SeedResult } from '../types';
import { getToken, apiClient } from '../helpers';
import { runCourseCreationDraftProperty } from './course-creation-draft.property';

const outputPath = path.resolve(__dirname, 'env-check.txt');

fs.writeFileSync(outputPath, 'STEP 0: All static imports resolved!\n');
fs.appendFileSync(outputPath, `fc.assert: ${typeof fc.assert}\n`);
fs.appendFileSync(outputPath, `getToken: ${typeof getToken}\n`);
fs.appendFileSync(outputPath, `apiClient: ${typeof apiClient}\n`);
fs.appendFileSync(outputPath, `runCourseCreationDraftProperty: ${typeof runCourseCreationDraftProperty}\n`);

runCourseCreationDraftProperty(1)
  .then((result) => {
    fs.appendFileSync(outputPath, `\nRESULT: ${JSON.stringify(result, null, 2)}\n`);
  })
  .catch((err) => {
    fs.appendFileSync(outputPath, `\nERROR: ${err.message}\n`);
  });
