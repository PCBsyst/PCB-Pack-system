import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/server-mfa-policy.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { evaluateServerMfa: check } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
let count = 0;
for (const level of [null, undefined, '', 'aal1', 'aal2', 'aal3']) {
  for (const owner of [false, true]) for (const enrolled of [false, true]) for (const failed of [false, true]) {
    const expected = failed || !['aal1','aal2'].includes(level) ? 'unavailable' : owner && !enrolled ? 'enroll' : enrolled && level !== 'aal2' ? 'challenge' : 'allow';
    assert.equal(check(level, owner, enrolled, failed), expected);
    count++;
  }
}
for (const file of ['../lib/supabase/proxy.ts','../lib/supabase/access.ts','../lib/server/api-auth.ts']) {
  assert.match(fs.readFileSync(new URL(file,import.meta.url),'utf8'), /await checkServerMfa/);
}
for (const file of ['../app/api/staff/invite/route.ts','../app/api/staff/identity/route.ts']) {
  assert.match(fs.readFileSync(new URL(file,import.meta.url),'utf8'), /await requireApiStaff\(\)/);
}
assert.doesNotMatch(fs.readFileSync(new URL('../app/auth/mfa/page.tsx',import.meta.url),'utf8'), /AppShell/);
const helperSource = fs.readFileSync(new URL('../lib/server/mfa-access.ts',import.meta.url),'utf8');
const policyJs = ts.transpileModule(fs.readFileSync(new URL('../lib/mfa-requirement.ts',import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const helperJs = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace('import "server-only";', '')
  .replace('"@/lib/mfa-requirement"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(policyJs).toString('base64')}`))
  .replace('"@/lib/server-mfa-policy"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`));
const { checkServerMfa } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);
const mock = (user, error = null, required = undefined) => ({auth:{getUser:async()=>({data:{user},error})},rpc:async()=>required===undefined?{data:null,error:{code:'PGRST202',message:'get_mfa_policy missing'}}:{data:{required,updatedAt:'2026-10-05T00:00:00Z'},error:null}});
assert.equal(await checkServerMfa(mock({id:'u',factors:[{status:'verified'}]},null,false),'u','aal1',true),'allow');
assert.equal(await checkServerMfa(mock({id:'u'},null,true),'u','aal1',false),'enroll');
assert.equal(await checkServerMfa(mock({id:'u'},null,false),'u','aal3',false),'unavailable');
const {readMfaPolicy}=await import(`data:text/javascript;base64,${Buffer.from(policyJs).toString('base64')}`);
for(const data of [null,{}, {required:'false',updatedAt:'2026-10-05'}, {required:false,updatedAt:'invalid'}]) assert.equal((await readMfaPolicy({rpc:async()=>({data,error:null})})).mode,'unavailable');
for(const error of [{code:'42501'}, {code:'PGRST202',message:'other missing'}]) assert.equal((await readMfaPolicy({rpc:async()=>({data:null,error})})).mode,'unavailable');
assert.equal((await readMfaPolicy({rpc:async()=>{throw Error('network')}})).mode,'unavailable');
assert.equal(await checkServerMfa(mock({id:'u',factors:[{status:'verified'}]}),'u','aal1',false),'challenge');
assert.equal(await checkServerMfa(mock({id:'u',factors:[{status:'verified'}]}),'u','aal2',true),'allow');
assert.equal(await checkServerMfa(mock({id:'u',factors:[{status:'unverified'}]}),'u','aal1',true),'enroll');
assert.equal(await checkServerMfa(mock({id:'other'}),'u','aal2',false),'unavailable');
assert.equal(await checkServerMfa(mock(null),'u','aal2',false),'unavailable');
assert.equal(await checkServerMfa(mock({id:'u'},new Error('test')),'u','aal2',false),'unavailable');
assert.equal(await checkServerMfa({auth:{getUser:async()=>{throw new Error('test')}}},'u','aal2',false),'unavailable');
console.log(`서버 MFA 정책: ${count}개 조합 및 보호 경로 연결 검사 통과. 실제 인증 서비스 시험은 별도 필요.`);
