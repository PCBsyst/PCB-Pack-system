import type { EvidenceReviewState } from "@/lib/evidence-review";
export function evidenceReviewSample():EvidenceReviewState {
  return {version:1,documents:[
    {id:"sample-app",kind:"신청서",fileName:"가상 신청서",sha256:"",reference:"기본정보",fields:{name:"가상후보",birthDate:"1990-01-01",trainingProvider:"가상교육원",trainingCompletedAt:"2026-01-10"}},
    {id:"sample-training",kind:"교육수료증",fileName:"가상 수료증",sha256:"",reference:"수료일 항목",fields:{name:"가상후보",birthDate:"1990-01-01",trainingProvider:"가상교육원",trainingCompletedAt:"2026-01-11"}},
    {id:"sample-career",kind:"경력증명서",fileName:"가상 경력·심사이력",sha256:"",reference:"1~2쪽",fields:{name:"가상후보",birthDate:"1990-01-01"}},
  ],careers:[
    {id:"career-a",documentId:"sample-career",organization:"가상회사 A",role:"품질관리",start:"2025-01-01",end:"2025-12-31",ongoing:false,reference:"1쪽 1행",confirmed:true},
    {id:"career-b",documentId:"sample-career",organization:"가상회사 B",role:"안전관리",start:"2025-07-01",end:"2026-01-31",ongoing:false,reference:"1쪽 2행",confirmed:true},
  ],audits:[
    {id:"audit-a",documentId:"sample-career",client:"가상 심사대상 A",standard:"ISO 9001",role:"심사원",start:"2026-02-01",end:"2026-02-02",days:"2",reference:"2쪽 1행",confirmed:true},
    {id:"audit-duplicate",documentId:"sample-career",client:"가상 심사대상 A",standard:"ISO 9001",role:"심사원",start:"2026-02-01",end:"2026-02-02",days:"2",reference:"2쪽 2행",confirmed:true},
    {id:"audit-overlap",documentId:"sample-career",client:"가상 심사대상 B",standard:"ISO 45001",role:"심사원",start:"2026-02-02",end:"2026-02-03",days:"2",reference:"2쪽 3행",confirmed:true},
    {id:"audit-clear",documentId:"sample-career",client:"가상 심사대상 C",standard:"ISO 9001",role:"심사원",start:"2026-03-01",end:"2026-03-01",days:"0.5",reference:"2쪽 4행",confirmed:true},
  ]};
}
