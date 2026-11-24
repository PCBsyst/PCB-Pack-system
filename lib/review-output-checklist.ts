import type {PackageContext} from '@/lib/prototype-package';
import type {Job} from '@/types/certification';
export type OutputCheck={document:string;items:string[]};
/** Advisory presence checks only. Never changes records or decides conformity. */
export function reviewOutputChecklist(context:PackageContext,job:Job,selected:string[]):OutputCheck[]{
 const checks:OutputCheck[]=[];
 const add=(file:string,label:string,fields:Array<[string,unknown]>,extra:string[]=[])=>{
  if(!selected.includes(file))return;
  checks.push({document:label,items:[...fields.filter(([,value])=>typeof value!=='string'||!value.trim()).map(([name])=>name),...extra]});
 };
 const common:Array<[string,unknown]>=[['후보자명',context.candidate.name],['Job 번호',job.jobNo],['신청표준',job.standard],['신청등급',job.currentGrade]];
 const review=context.review,certificate=context.certificates[job.id],records=context.deliveryDocuments[job.id];
 add('Application_Review_KR.html','신청서류 검토서',[...common,['접수일',context.application.receivedAt],['검토자',review.reviewer],['검토일',review.reviewedAt],['검토 결과',review.result],['검토 의견',review.comment],['검증인',review.verifier],['검증일',review.verifiedAt],['검증 결과',review.verificationResult],['검증 의견',review.verificationComment]]);
 const panel=context.panelMembers.filter(p=>p.selected),names=panel.map(p=>p.name.normalize('NFKC').trim());
 const panelIssues:string[]=[];
 if(new Set(names.filter(Boolean)).size<2)panelIssues.push('서로 다른 심의위원 2명 이상');
 panel.forEach((member,i)=>{if(!member.name.trim())panelIssues.push(`선택 위원 ${i+1} 이름`);if(!member.decision)panelIssues.push(`선택 위원 ${i+1} 결정`);if(!member.comment.trim())panelIssues.push(`선택 위원 ${i+1} 의견`);});
 add('Decision_Review_KR.html','인증결정보고서',[...common,['심의일',context.decisionDate],['최종 승인자',context.finalApprover],['최종 승인일',context.finalApprovalDate],['최종 승인 결과',context.decisions[job.id]?.result],['최종 승인 의견',context.decisions[job.id]?.comment],...['지식 시험','인성 시험','교육 요구사항','학력 요구사항','심사이력'].map(name=>[name+' 평가 기록',context.assessment[job.id]?.[name]] as [string,unknown])],panelIssues);
 const deliveryIssues:string[]=[];
 if(!records||!Object.keys(records).length)deliveryIssues.push('문서별 적용·확인 기록');
 else for(const [key,record]of Object.entries(records)){
  if(!record||!['REQUIRED','CONDITIONAL','NOT_APPLICABLE'].includes(record.applicability)){deliveryIssues.push('문서 적용 구분');continue;}
  if(record.applicability==='NOT_APPLICABLE')continue;
  const labels:Record<string,string>={application:'신청서',career:'경력증명서',education:'교육수료증',diploma:'학력 증빙',auditLog:'심사이력표',agreement:'인증계약서',examNotice:'시험통보서',examAnswers:'시험답안지',decisionReport:'인증결정보고서',certificate:'인증서',survey:'설문서',deliveryConfirmation:'문서전달확인서'};
  if(record.applicability==='REQUIRED'&&!record.received)deliveryIssues.push(`${labels[key]??'문서'} 확인 기록`);
  if(record.received&&!record.date)deliveryIssues.push(`${labels[key]??'문서'} 기록일`);
 }
 if(certificate?.originalSentAt&&!certificate.trackingNumber)deliveryIssues.push('원본 운송장 번호');
 if(certificate?.trackingNumber&&!certificate.originalSentAt)deliveryIssues.push('원본 송부일');
 add('Delivery_Confirmation_KR.html','문서전달확인서',[...common,['확인서 작성일',records?.deliveryConfirmation?.date],['인증번호',certificate?.certificationNo],['인증서 발행일',certificate?.issueDate]],deliveryIssues);
 return checks;
}
