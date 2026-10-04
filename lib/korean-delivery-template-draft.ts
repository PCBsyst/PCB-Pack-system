import type PizZip from "pizzip";

// 출력 배치 검증 전인 제작용 변환기입니다. 양식 레지스트리/API에 연결하지 않습니다.
const labels: Record<string, string> = {
  "List of Certification Documents": "문서전달확인서",
  Name: "후보자명", Standard: "신청표준", Grade: "등급",
  "Registration No.": "Job 번호", "Certification No.": "인증번호",
  Form: "양식번호", Document: "문서", Date: "기록일", Comment: "비고",
  "Application Form": "신청서", "Career Certification": "경력증명서",
  "Education Certificate (GPC approved training provider)": "교육수료증",
  Diploma: "학력 증빙자료", "Audit Log Sheet (if needed)": "심사이력 기록",
  "Certification Agreement": "인증계약서",
  "Examination Notice for Applicant(If applicable)": "시험통보서",
  "GPC Examination Answer Sheets": "시험답안지",
  "Certification Decision Report": "인증결정보고서",
  "Personnel Certificate *Audit Fee Deposit": "인증서",
  "Customer Survey Sheet": "고객 설문서",
  "Delivering Documents Conformation": "문서전달확인서",
  Note: "진행 기록 및 전달 정보",
};

function replaceParagraphText(paragraph: string, value: string) {
  let first = true;
  return paragraph.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, (_match, start, end) => {
    const text = first ? value : "";
    first = false;
    return `${start}${text}${end}`;
  });
}

export function prepareKoreanDeliveryTemplateDraft(zip: PizZip): void {
  const source = zip.file("word/document.xml")?.asText();
  if (!source) throw new Error("문서전달확인서 원본 본문이 없습니다.");
  let body = source.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
    if (text === "☐") return replaceParagraphText(paragraph, "");
    return Object.hasOwn(labels, text) ? replaceParagraphText(paragraph, labels[text]) : paragraph;
  });
  // 원본은 고정 체크박스 다음 두 셀에 Mark/Date가 들어가 있습니다.
  // 국문 초안은 실제 표의 표시/날짜/비고 열에 각각 하나씩 입력 칸을 배치합니다.
  body = body.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
    const key = row.match(/\{\{(\w+)Mark\}\}/)?.[1];
    if (!key) return row;
    const cells = [...row.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
    if (cells.length !== 5) throw new Error("표시·날짜·비고 열 구조를 확인하지 못했습니다.");
    let updated = row;
    for (const [index, suffix] of [[4, "Comment"], [3, "Date"], [2, "Mark"]] as const) {
      const match = cells[index];
      let inserted = false;
      const cell = match[0].replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
        if (inserted) return replaceParagraphText(paragraph, "");
        inserted = true;
        if (/<w:t(?:\s[^>]*)?>/.test(paragraph)) return replaceParagraphText(paragraph, `{{${key}${suffix}}}`);
        return paragraph.replace("</w:p>", `<w:r><w:t>{{${key}${suffix}}}</w:t></w:r></w:p>`);
      });
      if (!inserted) throw new Error("기록 셀의 문단을 확인하지 못했습니다.");
      updated = updated.slice(0, match.index) + cell + updated.slice(match.index + match[0].length);
    }
    return updated;
  });
  zip.file("word/document.xml", body);
}
