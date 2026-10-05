import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=(file)=>fs.readFileSync(new URL(file,import.meta.url),"utf8");
const compile=(text)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=(text)=>`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const {parseServerIdleStatus}=await import(url(compile(read("../lib/server-idle-session.ts"))));
const {idleState,idleStorageKey,IDLE_LIMIT_MS,IDLE_WARNING_MS}=await import(url(compile(read("../lib/idle-session.ts"))));
const source=compile(read("../components/idle-session-guard.tsx"));
const effect=source.slice(source.indexOf("    useEffect(() => {"),source.indexOf("    if (expired)"));
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setTimeout(resolve,0));};
function fixture(){
 let clock=Date.parse("2026-10-05T00:00:00Z"),serverLast=clock,cleanup,timer,fail=false;
 const requests=[],events={},storage=new Map(),state={},resume={current(){}},verify={current(){}},redirects=[];
 const deps={useEffect:callback=>{cleanup=callback();},hasEnvVars:true,createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:"staff"},access_token:"test.token.test"}},error:null}),signOut:async()=>({error:null}),onAuthStateChange:()=>({data:{listener:null,subscription:{unsubscribe(){}}}})}}),
 IDLE_LIMIT_MS,IDLE_WARNING_MS,idleState,idleStorageKey,parseServerIdleStatus,Date:{now:()=>clock,parse:Date.parse},performance:{now:()=>clock},AbortController,Event,
 window:{addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener(){},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{timer=fn;return 1;},clearInterval(){},dispatchEvent(){},location:{replace:path=>redirects.push(path)}},
 document:{visibilityState:"visible",addEventListener(){},removeEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
 fetch:async(_url,options)=>{requests.push(options.method);if(fail)throw Error("network");if(options.method==="POST")serverLast=clock;return Response.json({mode:"ready",serverNow:new globalThis.Date(clock).toISOString(),expiresAt:new globalThis.Date(serverLast+3600000).toISOString()});},
 setReady:value=>state.ready=value,setLoaded:value=>state.loaded=value,setExpired:value=>state.expired=value,setRemaining:value=>state.remaining=value,setNotice:value=>state.notice=value,resume,verify};
 new Function(...Object.keys(deps),effect)(...Object.values(deps));
 return {requests,state,events,resume,verify,redirects,stop:()=>cleanup(),tick:()=>timer(),advance:ms=>clock+=ms,fail:value=>fail=value};
}
let f=fixture();await flush();assert.deepEqual(f.requests,["GET"]);assert.equal(f.state.ready,true);
f.events.keydown({isTrusted:false});await flush();assert.equal(f.requests.length,1);
f.events.keydown({isTrusted:true});await flush();assert.deepEqual(f.requests,["GET","POST"]);
f.events.keydown({isTrusted:true});await flush();assert.equal(f.requests.length,2);
f.advance(60000);f.tick();await flush();assert.equal(f.requests.at(-1),"GET");
f.advance(3600000);f.events.keydown({isTrusted:true});await flush();assert.ok(f.redirects.includes("/auth/login?reason=idle"));assert.equal(f.requests.filter(method=>method==="POST").length,1);f.stop();
f=fixture();await flush();f.fail(true);f.advance(60000);f.tick();await flush();assert.equal(f.state.ready,false);assert.equal(f.state.loaded,true);assert.match(f.state.notice,/확인하지 못해/);
const previous=f.requests.length;f.events.keydown({isTrusted:true});await flush();assert.equal(f.requests.length,previous);
f.fail(false);f.verify.current();await flush();assert.equal(f.state.ready,true);assert.equal(f.requests.at(-1),"GET");f.stop();
f=fixture();f.stop();await flush();assert.ok(!f.state.ready);
console.log("실제 브라우저 활동 처리: 초기/주기 조회 미연장·실입력만 활동·30초 제한·만료 후 입력 거절·장애 시 상태 유지/재점검·화면 종료 응답 무시 통과 (브라우저 IO 모의)");
