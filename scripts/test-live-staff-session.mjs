import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const compile = (code) => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readStaffSession } = await import(`data:text/javascript;base64,${Buffer.from(compile(read("../lib/staff-session.ts"))).toString("base64")}`);
for (const [data, status] of [[true,"valid"],[false,"invalid"],[null,"unavailable"],[{},"unavailable"],["true","unavailable"],[1,"unavailable"]]) assert.equal(await readStaffSession({ rpc: async () => ({ data, error: null }) }),status);
for (const [error, status] of [[{code:"PGRST202",message:"has_live_staff_session missing"},"legacy"],[{code:"PGRST202",message:"other missing"},"unavailable"],[{code:"42501"},"unavailable"],[{code:"42P01",message:"auth.sessions missing"},"unavailable"]]) assert.equal(await readStaffSession({rpc:async()=>({data:null,error})}),status);
assert.equal(await readStaffSession({rpc:async()=>{throw Error("통신");}}),"unavailable");
const strip = (file) => compile(read(file)).replace(/^import .*;\r?$/gm, "").replace(/export /g, "");
function fixture({ active = true, session = true, sessionError = null, prototype = false } = {}) {
  const calls = [];
  const client = {auth:{getClaims:async()=>({data:{claims:{sub:"staff",aal:"aal2"}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{active,is_owner:false},error:null}),single:async()=>({data:{active,is_owner:false,role:"STAFF"},error:null})})})}),rpc:async(name)=>{calls.push(name);return {data:session,error:sessionError};}};
  const response = (value) => { value.cookies={getAll:()=>[],set(){}}; return value; };
  const NextResponse = {json:(value,init)=>response(Response.json(value,init)), next:()=>response(new Response()), redirect:(value)=>response(new Response(null,{status:307,headers:{Location:String(value)}}))};
  const deps = {NextResponse,readStaffSession,currentAuthEnvironment:()=>({blocked:false,localPrototype:prototype}),createClient:async()=>client,createServerClient:()=>client,
    checkServerMfa:async()=>{calls.push("mfa");return "allow";},evaluateFeatureControls:()=>"enabled",readOperationMode:async()=>({mode:"legacy"}),isOperationPaused:()=>false,
    process:{env:{}},redirect:(path)=>{throw new Error(`REDIRECT:${path}`);}};
  const make = (file, output) => new Function(...Object.keys(deps), `${strip(file)};return ${output};`)(...Object.values(deps));
  const api = make("../lib/server/api-auth.ts","requireApiStaff");
  const access = make("../lib/supabase/access.ts","getCurrentStaff");
  const proxy = make("../lib/supabase/proxy.ts","updateSession");
  const request = (path) => { const url=new URL(`https://example.com${path}`); url.clone=()=>new URL(url);return {nextUrl:url,cookies:{getAll:()=>[],set(){}}}; };
  return {api,access,proxy,request,calls};
}
let f=fixture(); assert.equal(await f.api(),null); assert.equal((await f.access()).id,"staff"); assert.equal((await f.proxy(f.request("/jobs"))).status,200);
f=fixture({session:false}); assert.equal((await f.api()).status,401); await assert.rejects(f.access,/reason=session-ended/); assert.equal((await f.proxy(f.request("/api/documents/package"))).status,401); assert.match((await f.proxy(f.request("/jobs"))).headers.get("Location"),/reason=session-ended/); assert.ok(!f.calls.includes("mfa"));
for(const options of [{sessionError:{code:"42501"}},{session:{}}]) { f=fixture(options); assert.equal((await f.api()).status,503); await assert.rejects(f.access,/verification-unavailable/); assert.equal((await f.proxy(f.request("/jobs"))).status,503); }
f=fixture({active:false}); assert.equal((await f.api()).status,403); assert.equal(f.calls.length,0);
f=fixture({sessionError:{code:"PGRST202",message:"has_live_staff_session missing"}}); assert.equal(await f.api(),null); assert.ok(f.calls.includes("mfa"));
f=fixture({prototype:true}); assert.equal(await f.api(),null); assert.equal(f.calls.length,0);
console.log("실제 서버/API/화면 가드: 종료 세션 차단·장애/잘못된 응답 거절·SQL 미적용 구분·비활성 우선 거절·가상모드 검사 통과 (인증/DB 모의)");
