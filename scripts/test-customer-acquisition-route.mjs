import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:p=>load(p.replace('@/lib/','')),Date,Map,Set,JSON,Error,Response,Headers});return exports;}
const code=ts.transpileModule(readFileSync('app/api/reports/customer-acquisition/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const rawApps=[{id:'app',candidate_id:'private-candidate-id',received_at:'2026-01-01',business_area:'ISO',partner_name_snapshot:'private-partner',status:'DOCUMENT_REVIEW'}];
const rawJobs=[{id:'private-job-id',application_id:'app',candidate_id:'private-candidate-id',standard:'ISO 9001',grade:'Auditor'}];
function fixture({denied=null,prototype=false,dbError=false,badCount=false,broken=false}={}){
 const events=[];
 const query=table=>({select(columns){events.push(['select',table,columns]);return this;},order(){return this;},async range(from,to){events.push(['query',table]);const rows=table==='applications'?rawApps:broken?[{...rawJobs[0],candidate_id:'wrong'}]:rawJobs;return {data:rows.slice(from,to+1),count:rows.length+(badCount?1:0),error:dbError?{message:'secret-db-error'}:null};}});
 const exports={};vm.runInNewContext(code,{exports,require:path=>{
   if(path.endsWith('/api-auth'))return {requireApiStaff:async()=>{events.push(['auth']);return denied;}};
   if(path.endsWith('/supabase/server'))return {createClient:async()=>({from:query})};
   if(path.endsWith('/auth-environment'))return {currentAuthEnvironment:()=>({localPrototype:prototype})};
   return load(path.replace('@/lib/',''));
 },Response,Headers,URL,TextEncoder,Date,JSON,Error});return {GET:exports.GET,events};
}
const request=(query='year=2026&area=전체&standard=전체&partner=전체',origin='https://example.test')=>new Request(`https://example.test/api/reports/customer-acquisition?${query}`,{headers:{Origin:origin}});
let f=fixture(),response=await f.GET(request());assert.equal(response.status,200);const body=await response.text();assert.ok(!body.includes('private-candidate-id'));assert.ok(!body.includes('private-job-id'));assert.ok(!body.includes('private-partner'));assert.ok(!body.includes('candidate_id'));assert.equal(Number(response.headers.get('X-Report-Bytes')),new TextEncoder().encode(body).length);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(f.events[0][0],'auth');assert.ok(f.events.filter(e=>e[0]==='select').every(e=>!/(name,|birth|email|phone|address|certification_records)/.test(e[2])));
for(const query of ['year=2026&area=전체&standard=전체','year=2026&area=전체&standard=전체&partner=전체&historyVerified=true','year=2026&year=2025&area=전체&standard=전체&partner=전체','year=2027&area=전체&standard=전체&partner=전체','year=2026&area=bad&standard=전체&partner=전체']){f=fixture();response=await f.GET(request(query));assert.equal(response.status,400);assert.equal(f.events.filter(e=>e[0]==='query').length,0);}
for(const [options,status] of [[{denied:Response.json({error:'denied'},{status:401})},401],[{prototype:true},503],[{dbError:true},503],[{badCount:true},503],[{broken:true},503]]){f=fixture(options);response=await f.GET(request());assert.equal(response.status,status);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.ok(!(await response.text()).includes('secret-db-error'));if(options.denied||options.prototype)assert.equal(f.events.filter(e=>e[0]==='query').length,0);}
f=fixture();assert.equal((await f.GET(request(undefined,'https://bad.test'))).status,403);
console.log('신규 비교 API: 권한 선검사·서버 재조회·별도 전체 신청/Job 조회·미완전/손상 차단·확정 위조 거절·식별자 미응답·캐시 금지 검사 통과 (인증/DB 모의)');
