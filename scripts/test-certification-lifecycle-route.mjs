import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:p=>load(p.replace('@/lib/','')),Date,Map,Set,JSON,Error,Response,Headers});return exports;}
const {certificationLifecycleSampleData:sample}=load('certification-lifecycle-sample');
const code=ts.transpileModule(readFileSync('app/api/reports/certification-lifecycle/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({denied=null,prototype=false,dbError=false,partial=false,malformed=false}={}){
 const events=[],s=sample(),tables={applications:s.applications,jobs:s.jobs,processing_cycles:s.cycles,certification_records:s.certificates,certification_actions:s.actions};
 if(malformed)tables.certification_records[0].valid_until='2026-02-30';
 const exports={};vm.runInNewContext(code,{exports,require:path=>{
  if(path.endsWith('/api-auth'))return {requireApiStaff:async()=>{events.push('auth');return denied;}};
  if(path.endsWith('/auth-environment'))return {currentAuthEnvironment:()=>({localPrototype:prototype})};
  if(path.endsWith('/supabase/server'))return {createClient:async()=>({from:table=>({select(columns){events.push(['select',table,columns]);return this;},order(){return this;},async range(from,to){events.push(['query',table]);return {data:tables[table].slice(from,to+1),count:tables[table].length+(partial?1:0),error:dbError?{message:'private-db-error'}:null};}})})};
  return load(path.replace('@/lib/',''));
 },Date,Response,Headers,URL,TextEncoder,JSON,Error});return {GET:exports.GET,events};
}
const request=(query='year=2026&area=전체&standard=전체&partner=전체',origin='https://example.test')=>new Request(`https://example.test/api/reports/certification-lifecycle?${query}`,{headers:{Origin:origin}});
let f=fixture(),response=await f.GET(request()),body=await response.text();assert.equal(response.status,200);assert.equal(JSON.parse(body).months[0].current.linkedRenewalIssued,1);assert.equal(JSON.parse(body).months[0].renewalRate,null);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(Number(response.headers.get('X-Report-Bytes')),new TextEncoder().encode(body).length);assert.equal(f.events[0],'auth');assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='query').length,5);assert.ok(!body.includes('candidate_id'));assert.ok(!body.includes('replaced_record_id'));assert.ok(!body.includes('sample-a'));assert.ok(f.events.filter(e=>Array.isArray(e)&&e[0]==='select').every(e=>!/(birth|email|phone|address|detail_reason|standard_reason|certification_no)/.test(e[2])));
for(const [options,status] of [[{denied:Response.json({error:'denied'},{status:401})},401],[{prototype:true},503],[{dbError:true},503],[{partial:true},503],[{malformed:true},503]]){f=fixture(options);response=await f.GET(request());assert.equal(response.status,status);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.ok(!(await response.text()).includes('private-db-error'));if(options.denied||options.prototype)assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='query').length,0);}
for(const query of ['year=2026&area=전체&standard=전체','year=2027&area=전체&standard=전체&partner=전체','year=2026&year=2025&area=전체&standard=전체&partner=전체','year=2026&area=전체&standard=전체&partner=전체&restoreHistoryComplete=true']){f=fixture();assert.equal((await f.GET(request(query))).status,400);assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='query').length,0);}
assert.equal((await fixture().GET(request(undefined,'https://bad.test'))).status,403);
console.log('인증 이력 API: 권한·설정 선검사·5개 원장 재조회·부분/손상 거절·식별자·사유 미응답·과거 이력 완전성 위조 차단·캐시 금지 검사 통과 (인증/DB 모의)');
