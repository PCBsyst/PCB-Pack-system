import type { RegistrationCandidate } from "@/lib/registration-candidate-validation";
import { isRegistrationDate } from "@/lib/allocated-number-validation";

export const intakeFields = {
  name: "후보자명", nameEn: "영문명", birthDate: "생년월일",
  nationality: "국적", email: "이메일", phone: "전화번호",
} satisfies Record<keyof RegistrationCandidate, string>;
export type IntakeField = keyof typeof intakeFields;
export type IntakeSuggestion = { field: IntakeField; value: string; evidence: string; conflict: boolean };
const labels: Record<IntakeField, string[]> = {
  name: ["성명", "한글성명", "한글명", "후보자명", "성명(한글)", "성명 (한글)", "Korean name"],
  nameEn: ["영문명", "영문성명", "성명(영문)", "성명 (영문)", "English name", "Name in English"],
  birthDate: ["생년월일", "Date of birth", "Birth date"],
  nationality: ["국적", "Nationality"], email: ["이메일", "이메일주소", "전자우편", "Email", "E-mail"],
  phone: ["전화번호", "휴대전화", "휴대폰", "연락처", "Mobile", "Phone"],
};
function cleanValue(field: IntakeField, input: string) {
  let value = input.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (!value || value.length > (field === "email" ? 254 : 200)) return null;
  if (field === "birthDate") {
    const match = value.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일|\.)?$/);
    if (!match) return null;
    value = `${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}`;
    if (!isRegistrationDate(value)) return null;
  }
  if (field === "email" && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return null;
  if (field === "phone" && !/^\+?[\d\s()\-]{7,40}$/.test(value)) return null;
  return value;
}
/** Only explicit labels are read. Missing/ambiguous values are never guessed. */
export function extractApplicationSuggestions(text: string): IntakeSuggestion[] {
  if (text.length > 1_000_000) throw new Error("신청서 본문이 너무 큽니다. 필요한 부분을 분리해 주세요.");
  const lines = text.replace(/\r\n?/g,"\n").split("\n");
  const result: IntakeSuggestion[] = [];
  for (const field of Object.keys(intakeFields) as IntakeField[]) {
    const found: Array<{value:string;evidence:string}> = [];
    for (const line of lines) {
      const cells = line.split("\t").map(cell=>cell.trim()).filter(Boolean);
      for (let i=0;i<cells.length;i++) {
        for (const label of labels[field]) {
          const escaped = label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
          const match = cells[i].match(new RegExp(`^${escaped}\\s*[:：]\\s*(.+)$`,"i"));
          const input = match?.[1] ?? (cells[i].toLowerCase() === label.toLowerCase() ? cells[i+1] : undefined);
          if (!input) continue;
          const value=cleanValue(field,input);
          if(value && !found.some(item=>item.value===value)) found.push({value,evidence:`${cells[i]}${match ? "" : ` → ${input}`}`.slice(0,400)});
        }
      }
    }
    if(found.length) result.push({field,value:found.length===1?found[0].value:"",evidence:found.map(item=>item.evidence).join(" / ").slice(0,1200),conflict:found.length>1});
  }
  return result;
}
