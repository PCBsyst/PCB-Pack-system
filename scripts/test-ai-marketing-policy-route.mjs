import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {createHash} from 'node:crypto';
const env={OPENAI_API_KEY:'test-private-key',OPENAI_MARKETING_MODEL:'test-private-model'},cache={};
function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:p=>p==='server-only'?{}:p==='node:crypto'?{createHash}:load(p.replace('@/lib/','')),Date,JSON,Error,Response,Headers,process:{env}});return exports;}
const code=ts.transpileModule(readFileSync('app/api/settings/ai-marketing-policy/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const input={enabled:true,retentionReviewed:true,privacyReviewed:true,reviewReference:'검토 문서 위치 2026-11-20',reason:'가상 정책 변경 테스트',expectedRevision:0};
function fixture({denied=null,owner=true,active=true,prototype=false,missing=false,conflict=false,saveError=false,noAudit=false}={}){
 const calls=[],stored={schema_version:'AI-MKT-POLICY-01',policy:{id:'MARKETING',enabled:false,retention_reviewed:false,privacy_reviewed:false,review_reference:'',config_fingerprint:'',revision:conflict?1:0},events:[]};
 const client={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{active,is_owner:owner},error:null})}),rpc:async(name,args)=>{
  calls.push([name,args]);if(missing)return {data:null,error:{code:'PGRST202'}};
  if(name==='read_ai_marketing_policy')return {data:JSON.parse(JSON.stringify(stored)),error:null};
  if(saveError)return {data:null,error:{code:'40001',message:'private-database-error'}};
  const before=stored.policy.enabled;stored.policy={id:'MARKETING',enabled:args.p_enabled,retention_reviewed:args.p_retention_reviewed,privacy_reviewed:args.p_privacy_reviewed,review_reference:args.p_review_reference,config_fingerprint:args.p_config_fingerprint,revision:stored.policy.revision+1};
  if(!noAudit)stored.events=[{id:'1',occurred_at:'2026-11-20T01:00:00Z',actor_id:'11111111-1111-4111-8111-111111111111',event_kind:'POLICY_UPDATED',policy_revision:stored.policy.revision,reason:args.p_reason,enabled_before:before,enabled_after:stored.policy.enabled,retention_reviewed:stored.policy.retention_reviewed,privacy_reviewed:stored.policy.privacy_reviewed,review_reference:stored.policy.review_reference,config_changed:true}];
  return {data:JSON.parse(JSON.stringify(stored)),error:null};
 }};
 const exports={};vm.runInNewContext(code,{exports,require:path=>{
  if(path.endsWith('/api-auth'))return {requireApiStaff:async()=>denied};
  if(path.endsWith('/supabase/server'))return {createClient:async()=>client};
  if(path.endsWith('/auth-environment'))return {currentAuthEnvironment:()=>({localPrototype:prototype})};
  return load(path.replace('@/lib/',''));
 },Date,Request,Response,Headers,URL,TextDecoder,TextEncoder,JSON,Error});return {...exports,calls};
}
const request=(body,origin='https://example.test')=>new Request('https://example.test/api/settings/ai-marketing-policy',{method:body===undefined?'GET':'POST',headers:{Origin:origin},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
let f=fixture(),response=await f.GET(request());assert.equal(response.status,200);assert.equal((await response.json()).policy.enabled,false);
response=await f.POST(request(input));assert.equal(response.status,200);let body=await response.text();assert.equal(JSON.parse(body).policy.enabled,true);assert.equal(JSON.parse(body).transportEnabled,false);assert.equal(JSON.parse(body).events.length,1);assert.ok(!body.includes('test-private-'));assert.ok(!body.includes('config_fingerprint'));assert.match(response.headers.get('Cache-Control'),/no-store/);assert.match(f.calls.at(-1)[1].p_config_fingerprint,/^[a-f0-9]{64}$/);
for(const [options,status] of [[{owner:false},403],[{active:false},403],[{denied:Response.json({error:'denied'},{status:401})},401],[{prototype:true},409],[{missing:true},503],[{conflict:true},409],[{saveError:true},409],[{noAudit:true},503]]){f=fixture(options);response=await f.POST(request(input));assert.equal(response.status,status);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.ok(!(await response.text()).includes('private-database-error'));if(options.owner===false||options.active===false||options.denied||options.prototype)assert.equal(f.calls.length,0);}
for(const body of [{...input,enabled:'true'},{...input,privacyReviewed:false},{...input,reviewReference:''},{...input,reason:''},{...input,expectedRevision:-1},{...input,configFingerprint:'forged'},'{bad','x'.repeat(8193)]){f=fixture();response=await f.POST(request(body));assert.ok([400,413].includes(response.status));assert.equal(f.calls.length,0);}
env.OPENAI_API_KEY='';f=fixture();assert.equal((await f.POST(request(input))).status,409);assert.equal(f.calls.length,0);f=fixture();assert.equal((await f.POST(request({...input,enabled:false,retentionReviewed:false,privacyReviewed:false,reviewReference:''}))).status,200);env.OPENAI_API_KEY='test-private-key';
assert.equal((await fixture().POST(request(input,'https://bad.test'))).status,403);f=fixture({prototype:true});assert.equal((await f.GET(request())).status,200);assert.equal(f.calls.length,0);
console.log('AI 정책 API: 소유자 한정·초기OFF·검토/설정/사유·버전 충돌·감사 응답 확인·미적용/가상 모드 저장 차단·비밀 해시 미반환·키 없이 OFF 허용 검사 통과 (DB/RPC 모의)');
