import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openApiJson } from '../src/openapi';
import { scopeMatrixMarkdown } from '../src/scopes';

const root = resolve(import.meta.dirname, '..');
writeFileSync(resolve(root, 'openapi.json'), openApiJson());
writeFileSync(resolve(root, 'SCOPES.md'), scopeMatrixMarkdown());
console.log('Wrote openapi.json and SCOPES.md');
