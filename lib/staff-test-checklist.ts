export const staffTestCases = [
 {id:"login",group:"계정·권한",title:"초대·로그인·계정 승인",href:"/staff-invitations",steps:"초대 받은 계정의 비밀번호를 설정합니다. 승인 전 업무 접근이 차단되는지, 최고관리자 활성화 후 로그인되는지 확인합니다."},
 {id:"mfa",group:"계정·권한",title:"테스트 모드와 MFA",href:"/settings#security",steps:"최고관리자가 설정한 MFA ON/OFF에 따라 로그인합니다. 일반 직원이 최고관리자 설정을 변경할 수 없는지 확인합니다. DB 설정 미적용이면 진행 불가로 기록합니다."},
 {id:"intake",group:"접수·검토",title:"신규 신청과 목록 연동",href:"/applications/new",steps:"가상 후보자·분야·등급으로 신청을 등록합니다. 후보자·Job·패키지에서 동일 신청이 연결되는지 확인합니다."},
 {id:"tracks",group:"접수·검토",title:"ISO·K뷰티 / 인정·비인정",href:"/applications",steps:"각 유형의 샘플을 만들고 목록 필터와 표준·등급·인정기구가 유지되는지 확인합니다. 인정·비인정 신청은 분리합니다."},
 {id:"review",group:"접수·검토",title:"1·2차 서류검토 저장",href:"/applications",steps:"샘플 신청의 검토 결과·보완 의견을 저장합니다. 새로고침 후 결과가 유지되고 해당 없음 문서가 필수로 강제되지 않는지 확인합니다."},
 {id:"training",group:"접수·검토",title:"교육기관·시험 날짜",href:"/applications",steps:"지정/비지정 연수기관과 시험 날짜를 입력합니다. 날짜 자동 적용 OFF에서는 기존 시험 날짜가 유지되는지, ON에서는 업무 규칙이 적용되는지 확인합니다."},
 {id:"invoice",group:"청구·입금",title:"인보이스·입금 기록",href:"/applications",steps:"번호·금액·발행일·입금일·입금자를 저장합니다. 통합 인보이스에 연결된 Job과 새로고침 후 값을 확인합니다."},
 {id:"panel",group:"심의·발행",title:"심의위원과 평가 항목",href:"/jobs",steps:"평가 5개 항목과 패널 2명 이상을 선택합니다. 부족한 위원/입력이 완료로 처리되지 않고 후보자별 인정·비인정 심의가 분리되는지 확인합니다."},
 {id:"approval",group:"심의·발행",title:"대표자 최종 승인",href:"/jobs",steps:"심의 결과와 별도로 대표자의 승인자·일자·의견을 기록하고 새로고침 및 보고서에서 확인합니다."},
 {id:"certificate",group:"심의·발행",title:"초안·전자본·원본 송부",href:"/jobs",steps:"초안 발행일·인증번호·전자본 발행일·만료일·원본 송부일·운송장 번호를 입력합니다. Job 번호/인증번호 규칙과 갱신 이력 연결을 확인합니다."},
 {id:"document",group:"문서·패키지",title:"Word 3종과 언어·필수 항목",href:"/packages",steps:"서류검토서·인증결정보고서·문서전달확인서의 선택한 언어로 다운로드합니다. 날짜·위원·승인·교육 항목을 대조합니다. 미등록 양식·검토용 초안은 정식 완료가 아닙니다."},
 {id:"package",group:"문서·패키지",title:"ZIP 구성과 저장값 대조",href:"/packages",steps:"ZIP 내부 문서와 package_manifest를 확인합니다. 누락 양식은 부분 패키지로 표시되는지, 저장하지 않은 입력/오류 때 완료로 기록되지 않는지 확인합니다."},
 {id:"lock",group:"보관·추적",title:"동시 조회·편집 제한",href:"/applications",steps:"샘플 신청을 서로 다른 직원 계정으로 엽니다. 동시에 조회는 가능하지만 한 명만 편집하며, 다른 직원의 저장값이 덮어써지지 않는지 확인합니다."},
 {id:"audit",group:"보관·추적",title:"정정·접근 이력과 권한",href:"/security/access-logs",steps:"샘플을 조회·정정하고 사유/변경 전후 값이 기록되는지 최고관리자가 확인합니다. 일반 직원의 접근이력 관리·삭제 접근은 차단되어야 합니다."},
 {id:"report",group:"현황·복구",title:"현황·필터·월간 보고",href:"/reports/monthly",steps:"표준·등급·파트너사·상태 필터와 샘플 집계를 대조합니다. 수익과 과거 월말 상태 추이는 별도 정합성 검증이 필요합니다."},
 {id:"resume",group:"현황·복구",title:"운영 모드 복구",href:"/settings#security",steps:"최고관리자가 사유를 입력해 정상 운영으로 복구합니다. 기존 기능별 OFF가 유지되고 중지 기간의 메일/문서/날짜를 일괄 실행하지 않는지 확인합니다."},
] as const;
export type StaffTestCaseId = typeof staffTestCases[number]["id"];
export const testStatuses = {NOT_RUN:"미실행",PASS:"통과",FAIL:"문제 발견",BLOCKED:"진행 불가"} as const;
export type StaffTestStatus = keyof typeof testStatuses;
export type StaffTestResult = {id:StaffTestCaseId;status:StaffTestStatus;note:string};
export type StaffTestReport = {schemaVersion:1;runId:string;reviewer:string;environment:"SHARED"|"LOCAL";updatedAt:string;results:StaffTestResult[]};
export function newStaffTestReport(runId:string,environment:StaffTestReport["environment"],now:string):StaffTestReport {
 return {schemaVersion:1,runId,reviewer:"",environment,updatedAt:now,results:staffTestCases.map(item=>({id:item.id,status:"NOT_RUN",note:""}))};
}
export function isStaffTestReport(value:unknown):value is StaffTestReport {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const report=value as Record<string,unknown>;
 return report.schemaVersion===1&&typeof report.runId==="string"&&/^[0-9a-f-]{36}$/i.test(report.runId)
  &&typeof report.reviewer==="string"&&report.reviewer.length<=80&&["SHARED","LOCAL"].includes(String(report.environment))
  &&typeof report.updatedAt==="string"&&Number.isFinite(Date.parse(report.updatedAt))&&Array.isArray(report.results)
  &&report.results.length===staffTestCases.length&&new Set(report.results.map(item=>item?.id)).size===staffTestCases.length
  &&report.results.every(item=>item&&typeof item==="object"&&staffTestCases.some(test=>test.id===item.id)&&Object.hasOwn(testStatuses,item.status)&&typeof item.note==="string"&&item.note.length<=1500);
}
export function staffTestReportIssues(report:StaffTestReport):string[] {
 return report.results.filter(item=>(item.status==="FAIL"||item.status==="BLOCKED")&&!item.note.trim()).map(item=>`${staffTestCases.find(test=>test.id===item.id)?.title}: 발생 상황을 입력해 주세요.`);
}
export function cleanStaffTestReport(report:StaffTestReport):StaffTestReport {
 return {schemaVersion:1,runId:report.runId,reviewer:report.reviewer,environment:report.environment,updatedAt:report.updatedAt,results:staffTestCases.map(test=>{const item=report.results.find(row=>row.id===test.id)!;return {id:item.id,status:item.status,note:item.note};})};
}
export function summarizeStaffTests(reports:StaffTestReport[]) {
 const totals={NOT_RUN:0,PASS:0,FAIL:0,BLOCKED:0};
 for(const report of reports)for(const item of report.results)totals[item.status]++;
 return totals;
}
export function mergeStaffTestReports(existing:StaffTestReport[],incoming:StaffTestReport[]):StaffTestReport[] {
 const records=new Map(existing.map(report=>[report.runId,report]));
 for(const report of incoming){const previous=records.get(report.runId);if(!previous||Date.parse(report.updatedAt)>Date.parse(previous.updatedAt))records.set(report.runId,report);}
 return [...records.values()];
}
export const staffTestStorageKey="staff-test-checklist:v1";
