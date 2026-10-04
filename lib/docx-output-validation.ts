import type PizZip from "pizzip";

/** Basic structure and unresolved text checks; not full OOXML or visual validation. */
export function validateGeneratedDocx(zip: PizZip): boolean {
  const document = zip.file("word/document.xml")?.asText();
  const types = zip.file("[Content_Types].xml")?.asText();
  if (!document || !types || !zip.file("_rels/.rels")
    || !/<(?:[\w.-]+:)?document\b/.test(document) || !/<(?:[\w.-]+:)?Types\b/.test(types)) return false;
  for (const name of Object.keys(zip.files).filter((name) => name.startsWith("word/") && name.endsWith(".xml"))) {
    const xml = zip.file(name)?.asText() ?? "";
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(xml)) return false;
    // Word can split a placeholder across multiple text runs, including headers/footers.
    const text = xml.replace(/<[^>]*>/g, "");
    if (/\{\{[^{}]{1,200}\}\}/.test(text)) return false;
  }
  return true;
}

export function invalidDocxResponse() {
  return Response.json({ error: "Word 문서에 미입력 자리표시자 또는 파일 구조 문제가 있어 생성을 중단했습니다. 양식과 입력값을 확인해 주세요." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
