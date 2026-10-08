import type { compareRegistrationExpectation } from "@/lib/registration-expectation";

export function registrationInspectionVerdict(issues: readonly string[], comparison: ReturnType<typeof compareRegistrationExpectation>) {
  if (issues.length || comparison && !comparison.matched) return { status: "REVIEW", title: "확인 필요", guidance: "원 신청서와 아래 불일치를 확인하세요. 부분 저장 가능성이 있으므로 재등록하지 말고 관리자에게 확인을 요청하세요." };
  if (!comparison) return { status: "UNCOMPARED", title: "원 신청 대조 미실시", guidance: "DB 연결만 확인했습니다. 원 신청 Job 수와 표준 목록을 입력해야 누락 여부를 대조할 수 있습니다." };
  if (!comparison.standardsProvided) return { status: "COUNT_ONLY", title: "건수만 대조 완료", guidance: "건수는 일치하지만 분야가 맞는지는 확인하지 않았습니다. 신청서의 표준 목록을 입력해 추가 대조하세요." };
  return { status: "MATCHED", title: "조회 연결·참고 표준 대조 일치", guidance: "조회 범위에서 일치합니다. 등급·증빙자료·동시 변경 여부와 전체 저장 완료까지 보증하는 결과는 아닙니다." };
}
