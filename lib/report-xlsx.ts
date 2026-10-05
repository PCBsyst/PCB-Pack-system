import PizZip from "pizzip";

type Cell = string | number;
export type ReportSheet = { name: string; rows: Cell[][]; widths: number[]; filter?: boolean };
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
function column(index: number): string { let name = ""; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name; return name; }

/** Snapshot-only XLSX: untrusted text is inlineStr, never interpreted as a formula. */
export function createReportXlsx(sheets: ReportSheet[]): Blob {
  if (!sheets.length || sheets.length > 10 || new Set(sheets.map(sheet => sheet.name)).size !== sheets.length) throw new Error("Excel 시트 구성이 올바르지 않습니다.");
  const zip = new PizZip();
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  sheets.forEach((sheet, index) => {
    if (!sheet.name || sheet.name.length > 31 || /[\\/\[\]:*?]/.test(sheet.name) || sheet.rows.length > 10000 || !sheet.rows.length || sheet.widths.length > 30 || !sheet.widths.length) throw new Error("Excel 시트 범위를 확인해 주세요.");
    const data = sheet.rows.map((row, r) => {
      if (row.length > sheet.widths.length) throw new Error("Excel 열 구성이 올바르지 않습니다.");
      const cells = row.map((value, c) => {
        const ref = `${column(c)}${r + 1}`;
        if (typeof value === "number") {
          if (!Number.isFinite(value)) throw new Error("Excel에 기록할 숫자가 올바르지 않습니다.");
          return `<c r="${ref}" s="${r === 0 ? 1 : 2}"><v>${value}</v></c>`;
        }
        if (value.length > 32767) throw new Error("Excel 셀의 내용이 너무 깁니다.");
        return `<c r="${ref}" s="${r === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join("");
      const lines = Math.max(1, ...row.map((value, c) => String(value).split(/\r?\n/).reduce((sum, text) => sum + Math.max(1, Math.ceil([...text].reduce((length, char) => length + (char.charCodeAt(0) > 127 ? 2 : 1), 0) / sheet.widths[c])), 0)));
      return `<row r="${r + 1}" ht="${Math.max(r === 0 ? 30 : 25, Math.min(120, lines * 18))}" customHeight="1">${cells}</row>`;
    }).join("");
    const cols = sheet.widths.map((width, c) => {
      if (!Number.isFinite(width) || width < 5 || width > 100) throw new Error("Excel 열 너비가 올바르지 않습니다.");
      return `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`;
    }).join("");
    const range = `A1:${column(sheet.widths.length - 1)}${sheet.rows.length}`;
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="25"/><cols>${cols}</cols><sheetData>${data}</sheetData>${sheet.filter ? `<autoFilter ref="${range}"/>` : ""}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`);
  });
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF243B53"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  const bytes = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
