import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.resolve(__dirname, 'test-output.txt');

const info = {
  dirname: __dirname,
  cwd: process.cwd(),
  nodeModulesExists: fs.existsSync(path.resolve(process.cwd(), 'node_modules', 'fast-check')),
  parentNodeModules: fs.existsSync(path.resolve(__dirname, '..', '..', '..', 'api', 'node_modules', 'fast-check')),
  rootNodeModules: fs.existsSync(path.resolve(__dirname, '..', '..', '..', 'node_modules')),
};

fs.writeFileSync(outputPath, JSON.stringify(info, null, 2) + '\n');
