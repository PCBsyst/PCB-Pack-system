import type PizZip from "pizzip";

// 정식 등록과 별도의 검토용 출력은 구분합니다. 일반적인 '초안' 항목은 허용합니다.
export function documentTemplateRegistrationIssue(zip: PizZip, missing: string[]): string | null {
  for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
    if (!zip.file(part)) return "정상적인 Word DOCX 양식이 아닙니다.";
  }
  const visibleText = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))
    .flatMap((name) => [...zip.file(name)!.asText().replace(/<!--[\s\S]*?-->/g, "").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]))
    .join("");
  if (visibleText.includes("출력 배치 미검증") || visibleText.includes("정식 패키지 완료에 포함되지 않음")) {
    return "검토용 초안은 정식 양식으로 등록할 수 없습니다. 출력 배치를 확인한 정식 양식을 준비해 주세요.";
  }
  if (missing.length) return `양식 본문의 필수 입력 칸을 확인해 주세요: ${missing.join(", ")}`;
  return null;
}
