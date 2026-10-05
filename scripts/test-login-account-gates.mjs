import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../components/login-form.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('login.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='handleLogin')handler=node.initializer.getText(ast);ts.forEachChild(node,visit);}
visit(ast);assert.ok(handler);
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const policyCode=compile(fs.readFileSync(new URL('../lib/mfa-requirement.ts',import.meta.url),'utf8'));
const {readMfaPolicy}=await import(`data:text/javascript;base64,${Buffer.from(policyCode).toString('base64')}`);
async function run(options={}){
 const state={finished:0,error:null,assurance:0,rpc:0,factors:[],loading:false};
 const client={auth:{signInWithPassword:async()=>({data:{session:options.noSession?null:{user:{id:'staff'},access_token:'sample'}},error:options.passwordError?Error('비밀번호 오류'):null}),mfa:{getAuthenticatorAssuranceLevel:async()=>{state.assurance++;return {data:{currentLevel:'aal1',nextLevel:options.enrolled?'aal2':'aal1'},error:null}},listFactors:async()=>({data:{totp:[{id:'factor'}]},error:options.factorError?Error('factor'):null})}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:options.missingProfile?null:{active:options.active??true},error:options.profileError?Error('profile'):null})})})}),rpc:async()=>{state.rpc++;return options.policyError?{data:null,error:{code:'42501'}}:options.legacy?{data:null,error:{code:'PGRST202',message:'get_mfa_policy missing'}}:{data:{required:options.required??false,updatedAt:'2026-10-05T00:00:00Z'},error:null}}};
 const deps={hasEnvVars:true,createClient:()=>client,email:'sample@example.test',password:'sample',setPassword:()=>{},setIsLoading:v=>state.loading=v,setError:v=>state.error=v,localStorage:{setItem:()=>{}},idleStorageKey:()=> 'sample',readMfaPolicy,needsMfaChallenge:(current,next)=>current!=='aal2'&&next==='aal2',finishLogin:()=>state.finished++,setFactors:v=>state.factors=v,setFactorId:()=>{}};
 // Extracted handler is the production source, not a copied simulation.
 const execute=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps; ${compile(`const handler=${handler};`)} return handler;`)(deps);
 await execute({preventDefault(){}});assert.equal(state.loading,false);return state;
}
const off=await run({enrolled:true});assert.equal(off.finished,1);assert.equal(off.assurance,0);
const on=await run({required:true,enrolled:true});assert.equal(on.finished,0);assert.equal(on.factors.length,1);
const legacy=await run({legacy:true,enrolled:true});assert.equal(legacy.finished,0);assert.equal(legacy.factors.length,1);
const inactive=await run({active:false});assert.equal(inactive.finished,0);assert.equal(inactive.rpc,0);assert.match(inactive.error,/활성화/);
for(const options of [{noSession:true},{passwordError:true},{missingProfile:true},{profileError:true},{policyError:true},{required:true,enrolled:true,factorError:true}]){const result=await run(options);assert.equal(result.finished,0);assert.ok(result.error);}
console.log('실제 로그인 처리: MFA OFF/ON·기존 정책·승인 대기·계정 조회·인증 오류 10개 경로 검사 통과 (인증/DB 모의)');
