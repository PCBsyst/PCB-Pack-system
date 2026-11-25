import type { PackageContext, DeliveryDocumentKey } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { documentDeliveryValues } from "@/lib/document-delivery-values";
import { documentHtmlStyles } from "@/lib/document-html-layout";
import {buildEnglishDeliveryConfirmationHtml} from "@/lib/delivery-confirmation-html-en";

export const deliveryConfirmationHtmlVersion="HTML-DC-01 v1";
export const deliveryConfirmationHtmlCsp="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
const escape=(v:unknown)=>String(v??"").replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const rows:ReadonlyArray<readonly [DeliveryDocumentKey,string]>=[['application','신청서'],['career','경력증명서'],['education','교육수료증'],['diploma','학력 증빙자료'],['auditLog','심사이력표'],['agreement','인증계약서'],['examNotice','시험통보서'],['examAnswers','시험답안지'],['decisionReport','인증결정보고서'],['certificate','개인인증서'],['survey','고객 설문지'],['deliveryConfirmation','문서전달확인서']];

/** Display stored records only. Never infer dispatch, delivery or unrecorded dates. */
export function buildDeliveryConfirmationHtml(context:PackageContext,job:Job,metadata:{generatedAt:string;recordHash:string;sample:boolean},language:"KR"|"EN"="KR") {
 if(!/^\d{4}-\d{2}-\d{2}T/.test(metadata.generatedAt)||!Number.isFinite(Date.parse(metadata.generatedAt))||!/^[a-f0-9]{64}$/.test(metadata.recordHash))throw Error('문서 생성 식별정보 오류');
 if(language==="EN")return buildEnglishDeliveryConfirmationHtml(context,job,metadata,deliveryConfirmationHtmlVersion,deliveryConfirmationHtmlCsp);
 const value=(v:unknown)=>escape(typeof v==='string'&&v.trim()&&v!=='-'?v:'미입력');
 const field=(label:string,v:unknown)=>`<div class="field"><dt>${escape(label)}</dt><dd>${value(v)}</dd></div>`;
 const section=(title:string,body:string,className='')=>`<section class="${escape(className)}"><h2>${title}</h2>${body}</section>`;
 const records=context.deliveryDocuments[job.id],certificate=context.certificates[job.id],dates=documentDeliveryValues(context,job.id,'KR'),schedule=context.examSchedules?.[job.id];
 const grades:Record<string,string>={'Auditor':'심사원','Lead Auditor':'선임심사원','Provisional Auditor':'심사원보','Internal Auditor':'내부심사원','Verification Auditor':'검증심사원'};
 const basic=`<dl class="fields">${field('후보자명',context.candidate.name)}${field('Job 번호',job.jobNo)}${field('신청표준',job.standard)}${field('신청등급',grades[job.currentGrade]??job.currentGrade)}${field('인증번호',certificate?.certificationNo)}${field('확인서 작성일',records?.deliveryConfirmation?.date)}</dl>`;
 const detailedNotes:string[]=[];
 const documents=`<table class="documents"><thead><tr><th>문서</th><th>적용</th><th>기록 확인</th><th>기록일</th><th>비고</th></tr></thead><tbody>${rows.map(([key,label])=>{
  const record=records?.[key],na=record?.applicability==='NOT_APPLICABLE';
  let comment=value(record?.comment);
  if(record?.comment&&(record.comment.length>240||record.comment.split('\n').length>3)){
   const number=detailedNotes.length+1;
   detailedNotes.push(`<div class="comment"><h3>${label} 비고 ${number}</h3><p>${value(record.comment)}</p></div>`);
   comment=`비고 ${number} 참조`;
  }
  return `<tr><th scope="row">${label}</th><td>${na?'해당 없음':record?.applicability==='REQUIRED'?'필수':record?.applicability==='CONDITIONAL'?'조건부':'미입력'}</td><td>${na?'해당 없음':record?.received?'확인됨':'미확인'}</td><td>${value(record?.date)}</td><td>${comment}</td></tr>`;
 }).join('')}</tbody></table><p class="note">문서별 확인은 저장된 업무 기록입니다. 미확인은 미제출 판정이나 고객의 실제 수령 여부를 뜻하지 않습니다.</p>${detailedNotes.join('')}`;
 const chronology=`<dl class="fields">${field('신청 접수일',dates.receivedAt)}${field('서류 검토일',dates.reviewedAt)}${field('2차 검증일',dates.verifiedAt)}${field('심의일',dates.decisionDate)}${field('최종 승인일',dates.finalApprovalDate)}${field('초안 발행일',dates.draftIssuedAt)}${field('인증서 발행일',dates.issueDate)}${field('인증 만료일',dates.expiryDate)}</dl>`;
 const training=`<dl class="fields">${field('교육기관 구분',schedule?schedule.providerType==='PARTNER'?'지정 연수기관':'비지정 교육기관':'')}${field('교육기관',schedule?.providerName)}${field('지정번호',schedule?.providerType==='PARTNER'?schedule.providerDesignationNo:'')}${field('교육 종료일',schedule?.trainingEndDate)}${field('시험통보일',schedule?.examNoticeDate)}${field('시험일',schedule?.examDate)}</dl>`;
 const shipping=`<dl class="fields">${field('인보이스 번호',context.invoiceNo)}${field('인보이스 발행일',dates.invoiceIssuedAt)}${field('입금 확인일',dates.paymentConfirmedAt)}${field('원본 송부일',dates.originalSentAt)}${field('운송장 번호',dates.trackingNumber)}${field('담당자',context.application.primaryOwner)}</dl><p class="note">운송장 번호는 배송 추적용입니다. 인증서 발행일이나 원본 송부일을 고객 수령일로 간주하지 않습니다.</p>`;
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${escape(deliveryConfirmationHtmlCsp)}"><meta name="report-template" content="${deliveryConfirmationHtmlVersion}"><title>문서전달확인서 ${escape(job.jobNo)}</title><style>${documentHtmlStyles(deliveryConfirmationHtmlVersion)}</style></head><body><main class="sheet"><header class="masthead"><div class="brand">GPC</div><div class="status">${metadata.sample?'가상 데이터 검토본':'HTML 디자인 검토본'}</div></header><h1>문서전달확인서</h1><p class="subtitle">신청부터 검토·심의·인증서 발행과 송부까지 저장된 문서 기록과 날짜를 확인합니다.</p>${section('01 신청 및 인증 대상',basic)}${section('02 문서별 접수 및 확인 기록',documents)}${section('03 검토 및 인증 처리 일정',chronology)}${section('04 교육 및 시험 기록',training)}${section('05 청구 및 원본 송부 기록',shipping,'verification')}<footer class="provenance"><p>${deliveryConfirmationHtmlVersion} · ${value(job.jobNo)} · 생성일시 한국시간 ${escape(new Date(metadata.generatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}))}</p><p>편집 가능한 HTML 디자인 검토본입니다. 정식 DOCX와 별도이며 패키지 완료나 PDF 저장 완료를 기록하지 않습니다. 인쇄 시 A4를 선택하세요.</p><p class="digest">기록 스냅샷 SHA-256 ${metadata.recordHash}</p></footer></main></body></html>`;
}
