import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const policyUrl=url(compile(read('lib/operation-mode.ts')));
const {readOperationMode,isOperationPaused,isOperationMode}=await import(policyUrl);
const normal={active:false,paused:[],endsOn:null,updatedAt:'2026-10-05T00:00:00Z'};
const active={...normal,active:true,paused:['AUTOMATIC_DATES','DOCUMENT_GENERATION'],endsOn:'2026-10-06'};
assert.equal(isOperationPaused({mode:'ready',policy:active},'DOCUMENT_GENERATION'),true);
assert.equal(isOperationPaused({mode:'ready',policy:active},'INVITATION_EMAIL'),false);
assert.equal(isOperationPaused({mode:'ready',policy:normal},'DOCUMENT_GENERATION'),false);
assert.equal(isOperationPaused({mode:'legacy'},'DOCUMENT_GENERATION'),false);
assert.equal(isOperationPaused({mode:'unavailable'},'DOCUMENT_GENERATION'),true);
for(const value of [null,{}, {...normal,paused:['LOGIN']},{...normal,active:'false'},{...normal,updatedAt:'invalid'},{...normal,paused:['NOTIFICATIONS','NOTIFICATIONS']}])assert.equal(isOperationMode(value),false);
assert.equal((await readOperationMode({rpc:async()=>({data:active,error:null})})).mode,'ready');
for(const error of [{code:'42501'},{code:'PGRST202',message:'different RPC missing'}])assert.equal((await readOperationMode({rpc:async()=>({data:null,error})})).mode,'unavailable');
assert.equal((await readOperationMode({rpc:async()=>{throw Error('network')}})).mode,'unavailable');
assert.equal((await readOperationMode({rpc:async()=>({data:null,error:{code:'PGRST202',message:'get_operation_mode missing'}})})).mode,'legacy');

// Execute the actual server guard, with authentication and DB responses mocked.
const stateUrl=url('export const state={policy:null,active:true,owner:false,features:true,mfa:"allow"};');
const {state}=await import(stateUrl);
const clientUrl=url(`import {state} from ${JSON.stringify(stateUrl)};
export async function createClient(){return {
 auth:{getClaims:async()=>({data:{claims:{sub:'u',aal:'aal1'}}})},
 from:table=>({select:()=>{
  if(table==='profiles')return {eq:()=>({maybeSingle:async()=>({data:{active:state.active,is_owner:state.owner},error:null})})};
  return {in:async(_,ids)=>({data:ids.map(id=>({id,enabled:state.features,updated_at:'2026-10-05'})),error:null})};
 }}),rpc:async()=>state.policy
};}`);
const dependencies={
 'next/server':url('export const NextResponse=Response;'),
 '@/lib/supabase/server':clientUrl,
 '@/lib/supabase/auth-environment':url('export function currentAuthEnvironment(){return {blocked:false,localPrototype:false};}'),
 '@/lib/feature-controls':url(compile(read('lib/feature-controls.ts'))),
 '@/lib/operation-mode':policyUrl,
 '@/lib/server/mfa-access':url(`import {state} from ${JSON.stringify(stateUrl)}; export async function checkServerMfa(){return state.mfa;}`),
 '@/lib/staff-session':url('export async function readStaffSession(){return "valid";}'),
};
let server=compile(read('lib/server/api-auth.ts')).replace('import "server-only";','');
for(const [key,value] of Object.entries(dependencies))server=server.replace(JSON.stringify(key),JSON.stringify(value));
const {requireApiStaff}=await import(url(server));
state.policy={data:active,error:null};
assert.equal((await requireApiStaff(['DOCUMENT_GENERATION'])).status,403);
assert.equal(await requireApiStaff([], 'INVITATION_EMAIL'),null);
state.policy={data:{...active,paused:['INVITATION_EMAIL']},error:null};
assert.equal((await requireApiStaff([], 'INVITATION_EMAIL')).status,403);
state.policy={data:normal,error:null};assert.equal(await requireApiStaff(['DOCUMENT_GENERATION']),null);
state.features=false;assert.equal((await requireApiStaff(['DOCUMENT_GENERATION'])).status,403);state.features=true;
state.active=false;assert.equal((await requireApiStaff([], 'INVITATION_EMAIL')).status,403);state.active=true;
state.mfa='challenge';assert.equal((await requireApiStaff([], 'INVITATION_EMAIL')).status,403);state.mfa='allow';
state.policy={data:null,error:{code:'42501'}};assert.equal((await requireApiStaff(['DOCUMENT_GENERATION'])).status,503);

// OFF date edits must not calculate or modify other saved dates.
const ast=ts.createSourceFile('detail.tsx',read('components/application-detail.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['changeExamScheduleStored','changeCertificateStored','changeIssueDate'];
const declarations=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(ast));
assert.equal(declarations.length,3);
let calculated=0;
const functions=new Function('nextKoreanBusinessDay','addKoreanBusinessDays',compile(declarations.join('\n'))+'return {changeExamScheduleStored,changeCertificateStored};')
 (value=>{calculated++;return 'shift:'+value;},(value,days)=>{calculated++;return `shift:${value}:${days}`;});
const initial={decisionDate:'2026-09-01',certificates:{j:{issueDate:'2026-09-02',expiryDate:'2027-09-02'}},examSchedules:{j:{providerType:'PARTNER',trainingEndDate:'2026-08-01',examDate:'2026-08-01',examNoticeDate:'2026-07-25'}},deliveryDocuments:{j:{certificate:{received:true,date:'2026-09-02'},deliveryConfirmation:{received:true,date:'2026-09-03'},examNotice:{received:true,date:'2026-07-25'},examAnswers:{received:true,date:'2026-08-01'}}}};
let edited=structuredClone(initial);const set=update=>edited=update(edited);
functions.changeCertificateStored('j','issueDate','2026-10-03',{decisionDays:5,deliveryDays:1},set,false);
assert.equal(edited.certificates.j.issueDate,'2026-10-03');assert.equal(edited.decisionDate,initial.decisionDate);assert.deepEqual(edited.deliveryDocuments,initial.deliveryDocuments);
functions.changeExamScheduleStored('j',{providerType:'NON_PARTNER'},'2026-10-05',set,false);
assert.equal(edited.examSchedules.j.examDate,initial.examSchedules.j.examDate);assert.deepEqual(edited.deliveryDocuments,initial.deliveryDocuments);assert.equal(calculated,0);
edited.deliveryDocuments.j.examNotice.date='2026-07-20';
functions.changeExamScheduleStored('j',{examDate:'2026-09-20'},'2026-10-05',set,false);
assert.equal(edited.deliveryDocuments.j.examNotice.date,'2026-07-20');assert.equal(edited.deliveryDocuments.j.examAnswers.date,'2026-09-20');assert.equal(calculated,0);
functions.changeCertificateStored('j','issueDate','2026-10-06',{decisionDays:5,deliveryDays:1},set,true);assert.ok(calculated>0);
const sql=read('supabase/migrations/202610050027_operation_mode.sql');
for(const pattern of [/not public.is_admin\(\)/,/app.correction_reason/,/expected_updated_at/,/on conflict\(id\) do nothing/,/enable row level security/,/write_audit_log/,/Asia\/Seoul/])assert.match(sql,pattern);
assert.doesNotMatch(sql,/delete from|update public\.mfa_policy|update public\.feature_controls/i);
assert.match(read('components/settings-workspace.tsx'),/<OperationModeSettings \/>/);
assert.match(read('components/app-shell.tsx'),/<OperationModeBanner \/>/);
assert.match(read('components/notification-center.tsx'),/isOperationPaused\(operationMode, "NOTIFICATIONS"\)/);
console.log('이관·테스트 모드: 설정 오류 차단·문서/초대 서버 제한·보안 유지·기존 날짜 보존·수동 복구·SQL 권한/감사 검사 통과 (실제 DB 검증 별도)');
