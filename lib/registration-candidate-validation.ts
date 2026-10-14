import type { CandidateForm } from "@/lib/candidate-form";
import { isRegistrationDate } from "@/lib/allocated-number-validation";

type RegistrationCandidate = Omit<CandidateForm, "address">;
export function registrationCandidateIssue(input: RegistrationCandidate, receivedAt: string): string | null {
  const limits: Array<[keyof RegistrationCandidate, string, number]> = [
    ["name", "후보자명", 500], ["nameEn", "영문명", 500], ["nationality", "국적", 200],
    ["email", "이메일", 254], ["phone", "전화번호", 100],
  ];
  for (const [field, label, max] of limits) {
    if (input[field].trim().length > max || /[\u0000-\u001f\u007f]/.test(input[field])) return `${label}에 제어문자가 포함되어 있거나 허용 길이(${max}자)를 초과했습니다.`;
  }
  if (!input.name.trim()) return "후보자 이름을 입력해 주세요.";
  if (input.birthDate && (!isRegistrationDate(input.birthDate) || isRegistrationDate(receivedAt) && input.birthDate > receivedAt)) return "생년월일은 실제 날짜이며 접수일 이후가 아니어야 합니다.";
  const email = input.email.trim();
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return "이메일 주소 형식을 확인해 주세요.";
  return null;
}
