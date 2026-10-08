import { numberingRules, type NumberingRule } from "@/lib/numbering-rules";
export const CERTIFICATION_FIELDS_KEY = "certification_fields_v1";
export function createCertificationField(input: { businessArea: string; scheme: string; accreditationTrack: string; field: string; jobPrefix: string; certificateCode: string }): NumberingRule {
  const field = input.field.trim(), jobPrefix = input.jobPrefix.trim().toUpperCase(), certificateCode = input.certificateCode.trim().toUpperCase();
  if (!["ISO", "K_BEAUTY"].includes(input.businessArea) || !["IAS", "PJLA"].includes(input.scheme) || !["ACCREDITED", "NON_ACCREDITED"].includes(input.accreditationTrack)
    || !field || field.length > 100 || /[\u0000-\u001f]/.test(field) || !/^[A-Z][A-Z0-9-]{1,11}$/.test(jobPrefix)
    || !(input.businessArea === "ISO" && input.scheme === "IAS" ? /^[0-9]$/ : /^[A-Z0-9]{1,8}$/).test(certificateCode)) throw new Error("분야명·Job 접두어·인증번호 코드를 확인해 주세요. ISO/IAS 인증번호 코드는 8자리 형식 유지를 위해 숫자 한 자리입니다.");
  const businessArea = input.businessArea as NumberingRule["businessArea"], scheme = input.scheme as NumberingRule["scheme"];
  const certificatePattern = `${businessArea === "K_BEAUTY" ? "KB-" : ""}YY${scheme === "PJLA" ? "-" : ""}${certificateCode}GNNNN`;
  return { businessArea, scheme, accreditationTrack: input.accreditationTrack as NumberingRule["accreditationTrack"], field, jobPrefix, certificateCode, jobPattern: `${jobPrefix}YYNNNN`, certificatePattern, sourceSheet: "관리자 등록", verified: true };
}
export function parseAdditionalCertificationFields(value: unknown): NumberingRule[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("인증분야 설정 구성 오류");
  const all = [...numberingRules], result: NumberingRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("인증분야 항목 오류");
    const row = item as Record<string, unknown>;
    if (["businessArea", "scheme", "accreditationTrack", "field", "jobPrefix", "certificateCode"].some(key => typeof row[key] !== "string")) throw new Error("인증분야 항목 누락");
    const rule = createCertificationField(row as Parameters<typeof createCertificationField>[0]);
    if (all.some(existing => existing.businessArea === rule.businessArea && existing.scheme === rule.scheme && existing.field.trim().normalize("NFC").toUpperCase() === rule.field.normalize("NFC").toUpperCase() && (!existing.accreditationTrack || existing.accreditationTrack === rule.accreditationTrack))) throw new Error("이미 등록된 분야입니다.");
    if (all.some(existing => existing.jobPrefix.replace(/-/g, "") === rule.jobPrefix.replace(/-/g, ""))) throw new Error("이미 사용하는 Job 접두어입니다. 다른 접두어를 입력해 주세요.");
    if (all.some(existing => existing.businessArea === rule.businessArea && existing.scheme === rule.scheme && existing.certificateCode === rule.certificateCode)) throw new Error("동일 분야·인정기구에서 사용하는 인증번호 코드입니다.");
    all.push(rule); result.push(rule);
  }
  return result;
}
