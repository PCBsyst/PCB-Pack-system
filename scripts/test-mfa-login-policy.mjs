import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/mfa-login-policy.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { needsMfaChallenge } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for (const current of [null, 'aal1', 'aal2']) {
  for (const next of [null, 'aal1', 'aal2']) {
    assert.equal(needsMfaChallenge(current, next), next === 'aal2' && current !== 'aal2');
  }
}
console.log('MFA login policy: 9 cases passed');
