import { registrationCandidateIssues, type RegistrationCandidate } from "@/lib/registration-candidate-validation";

export function RegistrationCandidateFeedback({ input, receivedAt, existing }: { input: RegistrationCandidate; receivedAt: string; existing: boolean }) {
  if (existing) return null;
  const issues = registrationCandidateIssues(input, receivedAt);
  if (!issues.length) return null;
  return <section role="status" aria-live="polite" aria-label="후보자 입력 확인" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
    <h2 className="font-semibold">후보자 입력 확인 · {issues.length}건</h2>
    <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((issue,index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
    <p className="mt-2 text-xs">입력을 수정하면 안내가 갱신됩니다. 선택 항목은 비워둘 수 있습니다. 이 검사는 전체 신청의 저장 가능 여부를 보증하지 않습니다.</p>
  </section>;
}
