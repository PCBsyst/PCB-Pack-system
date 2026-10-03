export type CandidateForm = { name: string; nameEn: string; birthDate: string; nationality: string; email: string; phone: string; address: string };
export const candidateFieldLabels: Record<keyof CandidateForm, string> = { name: "후보자명", nameEn: "영문명", birthDate: "생년월일", nationality: "국적", email: "이메일", phone: "전화번호", address: "주소" };
export function candidateFormFromRow(row: Record<string, unknown>): CandidateForm {
  const text = (key: string) => typeof row[key] === "string" ? row[key] as string : "";
  return { name: text("name"), nameEn: text("name_en"), birthDate: text("birth_date"), nationality: text("nationality"), email: text("email"), phone: text("phone"), address: text("address") };
}
export function changedCandidateFields(input: CandidateForm, latest: CandidateForm) {
  return (Object.keys(candidateFieldLabels) as Array<keyof CandidateForm>).filter((key) => input[key] !== latest[key]);
}
