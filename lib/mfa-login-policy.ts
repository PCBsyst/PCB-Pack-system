// SDK는 향후 추가될 인증 수준도 문자열로 반환할 수 있습니다.
export type AssuranceLevel = string | null;
export function needsMfaChallenge(current: AssuranceLevel, next: AssuranceLevel): boolean {
  return current !== "aal2" && next === "aal2";
}
