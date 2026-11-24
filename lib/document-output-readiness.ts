import type {PackageContext,DocumentLanguage} from '@/lib/prototype-package';
import type {Job} from '@/types/certification';
import type {TemplateReadinessRow} from '@/lib/template-readiness';
import {corporateTemplateRegistry} from '@/lib/document-template-registry';
import {documentTranslationIssues} from '@/lib/document-translation-checks';

/** Keep template availability, language inputs and HTML support separate. */
export function documentOutputReadiness(rows:TemplateReadinessRow[]|null,context:PackageContext,jobs:Job[],languages:Record<DocumentLanguage,boolean>){
 return jobs.flatMap(job=>corporateTemplateRegistry.filter(definition=>languages[definition.language]).map(definition=>{
  const row=rows?.find(row=>row.id===definition.id);
  const source=row?.source??'UNKNOWN';
  const translationIssues=definition.language==='EN'?documentTranslationIssues(context,[job.id],[definition.documentType]):[];
  return {jobId:job.id,jobNo:job.jobNo,id:definition.id,label:definition.label,language:definition.language,source,
   issues:[...(source==='UNKNOWN'?['양식 조회 미확인']:source==='MISSING'?['정식 DOCX 양식 미등록']:[]),...translationIssues],
   htmlSupported:definition.language==='KR'||definition.documentType==='CERTIFICATION_DECISION_REPORT',translationIssues};
 }));
}
