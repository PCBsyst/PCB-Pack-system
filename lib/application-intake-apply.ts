import {intakeFields,type IntakeField} from "@/lib/application-intake";
import {registrationCandidateIssues,type RegistrationCandidate} from "@/lib/registration-candidate-validation";
export type IntakeApproval={field:IntakeField;value:string;approved:boolean;overwrite:boolean};
/** A staged import changes form inputs only. Registration and existing-candidate edits remain separate. */
export function approvedIntakePatch(current:RegistrationCandidate,baseline:RegistrationCandidate,rows:IntakeApproval[],receivedAt:string):Partial<RegistrationCandidate>{
  if(!rows.length||rows.length>6||new Set(rows.map(r=>r.field)).size!==rows.length)throw Error("확인할 항목이 없거나 중복되었습니다.");
  const patch:Partial<RegistrationCandidate>={};
  for(const row of rows){
    if(!Object.hasOwn(intakeFields,row.field)||typeof row.value!=="string"||typeof row.approved!=="boolean"||typeof row.overwrite!=="boolean")throw Error("지원하지 않는 입력 항목입니다.");
    if(!row.approved)continue;
    if(current[row.field]!==baseline[row.field])throw Error("대조 중 신청 입력값이 변경됐습니다. 문서를 다시 읽고 확인해 주세요.");
    const value=row.value.trim();if(!value)throw Error("선택한 항목의 값을 입력해 주세요.");
    if(current[row.field].trim()&&current[row.field].trim()!==value&&!row.overwrite)throw Error("기존 값 변경을 별도로 확인해 주세요.");
    patch[row.field]=value;
  }
  if(!Object.keys(patch).length)throw Error("원문을 확인한 항목을 선택해 주세요.");
  const issue=registrationCandidateIssues({...current,...patch},receivedAt).find(i=>Object.hasOwn(patch,i.field));
  if(issue)throw Error(issue.message);
  return patch;
}
