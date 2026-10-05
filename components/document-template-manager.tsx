"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileArchive, Loader2, Upload } from "lucide-react";
import PizZip from "pizzip";
import { missingDocumentTemplateFields } from "@/lib/document-template-fields";
import { documentTemplateRegistrationIssue } from "@/lib/document-template-registration";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { corporateTemplateRegistry, type CorporateDocumentType, type CorporateTemplateLanguage } from "@/lib/document-template-registry";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type StoredTemplate = {
  id: string;
  document_type: CorporateDocumentType;
  language: CorporateTemplateLanguage;
  version: string;
  original_file_name: string;
  active: boolean;
  created_at: string;
};

const typeLabels: Record<CorporateDocumentType, string> = {
  APPLICATION_REVIEW: "서류검토서",
  CERTIFICATION_DECISION_REPORT: "인증결정보고서",
  DELIVERY_CONFIRMATION: "문서전달확인서",
};

export function DocumentTemplateManager() {
  const supabase = useMemo(() => hasEnvVars ? createClient() : null, []);
  const [items, setItems] = useState<StoredTemplate[]>([]);
  const [documentType, setDocumentType] = useState<CorporateDocumentType>("APPLICATION_REVIEW");
  const [language, setLanguage] = useState<CorporateTemplateLanguage>("KR");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) { setSchemaReady(false); return; }
    const { data, error } = await supabase.from("document_templates").select("id, document_type, language, version, original_file_name, active, created_at").order("created_at", { ascending: false });
    if (error) { setSchemaReady(false); return; }
    setSchemaReady(true);
    setItems((data ?? []) as StoredTemplate[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function upload() {
    setNotice("");
    if (!supabase) { setNotice("Supabase 연결 후 양식을 등록할 수 있습니다."); return; }
    if (!file || !version.trim()) { setNotice("개정번호와 DOCX 파일을 모두 입력해 주세요."); return; }
    if (!file.name.toLowerCase().endsWith(".docx")) { setNotice("DOCX 파일만 등록할 수 있습니다."); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice("파일 크기는 10MB 이하여야 합니다."); return; }
    setBusy(true);
    try {
      const zip = new PizZip(await file.arrayBuffer());
      const issue = documentTemplateRegistrationIssue(zip, missingDocumentTemplateFields(zip, documentType));
      if (issue) { setNotice(issue); setBusy(false); return; }
    } catch {
      setNotice("DOCX 파일을 읽을 수 없습니다. 손상되거나 확장자만 변경된 파일인지 확인해 주세요.");
      setBusy(false); return;
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const storagePath = `${documentType}/${language}/${Date.now()}-${safeName}`;
    const { data: userData } = await supabase.auth.getUser();
    const { error: uploadError } = await supabase.storage.from("document-templates").upload(storagePath, file, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    if (uploadError) { setNotice(`파일 등록 실패: ${uploadError.message}`); setBusy(false); return; }
    const priorIds = items.filter((item) => item.document_type === documentType && item.language === language && item.active).map((item) => item.id);
    const { error: deactivateError } = await supabase.from("document_templates").update({ active: false, updated_at: new Date().toISOString() }).eq("document_type", documentType).eq("language", language).eq("active", true);
    if (deactivateError) { await supabase.storage.from("document-templates").remove([storagePath]); setNotice(`기존 양식 전환 실패: ${deactivateError.message}`); setBusy(false); return; }
    const { error: insertError } = await supabase.from("document_templates").insert({ document_type: documentType, language, version: version.trim(), storage_path: storagePath, original_file_name: file.name, active: true, uploaded_by: userData.user?.id ?? null });
    if (insertError) { await supabase.storage.from("document-templates").remove([storagePath]); if (priorIds.length) await supabase.from("document_templates").update({ active: true, updated_at: new Date().toISOString() }).in("id", priorIds); setNotice(`양식 정보 저장 실패: ${insertError.message}`); setBusy(false); return; }
    setNotice("새 양식을 활성 버전으로 등록했습니다. 이전 버전은 이력으로 보존됩니다.");
    setVersion(""); setFile(null); setBusy(false); await load();
  }

  return <section id="document-templates" className="mt-6 rounded-lg border bg-white shadow-sm">
    <div className="border-b px-5 py-4"><h2 className="font-semibold">문서 양식 관리</h2><p className="mt-1 text-sm text-slate-500">문서 종류와 언어별 DOCX 원본을 등록합니다. 새 버전을 등록하면 이후 생성부터 적용되고 기존 파일은 이력으로 남습니다.</p></div>
    <div className="p-5">
      {!schemaReady && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">문서 양식 관리 DB가 아직 준비되지 않았습니다. 최신 SQL 마이그레이션을 적용하면 등록 기능이 활성화됩니다. 현재 문서 생성은 내장 양식을 계속 사용합니다.</div>}
      <p className="mb-3 text-sm text-slate-500">등록 전에 본문 필수 입력 칸과 검토용 초안 표시를 검사합니다. 이 검사는 페이지 배치의 시각 검증을 대신하지 않습니다.</p>
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-[1.2fr_.7fr_1fr_1.8fr_auto]">
        <select className={controlClass} value={documentType} onChange={(event) => setDocumentType(event.target.value as CorporateDocumentType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={controlClass} value={language} onChange={(event) => setLanguage(event.target.value as CorporateTemplateLanguage)}><option value="KR">국문</option><option value="EN">영문</option></select>
        <input className={controlClass} value={version} onChange={(event) => setVersion(event.target.value)} placeholder="예: Rev.15" />
        <input className={controlClass} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Button disabled={busy || !schemaReady} onClick={upload}>{busy ? <Loader2 className="animate-spin"/> : <Upload/>}등록·교체</Button>
      </fieldset>
      {notice && <p role="status" className={`mt-3 text-sm font-medium ${notice.includes("등록했습니다") ? "text-emerald-700" : "text-amber-800"}`}>{notice}</p>}
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3 text-left">문서</th><th className="px-3 py-3 text-left">언어</th><th className="px-3 py-3 text-left">현재 버전</th><th className="px-3 py-3 text-left">원본 파일</th><th className="px-3 py-3 text-left">등록일</th><th className="px-3 py-3 text-left">상태</th></tr></thead><tbody className="divide-y">
        {items.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium">{typeLabels[item.document_type]}</td><td className="px-3 py-3">{item.language === "KR" ? "국문" : "영문"}</td><td className="px-3 py-3">{item.version}</td><td className="px-3 py-3 text-slate-600">{item.original_file_name}</td><td className="px-3 py-3 text-slate-500">{new Date(item.created_at).toLocaleDateString("ko-KR")}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{item.active ? "사용 중" : "이전 버전"}</span></td></tr>)}
        {items.length === 0 && corporateTemplateRegistry.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium"><FileArchive className="mr-2 inline h-4 w-4 text-slate-400"/>{item.label}</td><td className="px-3 py-3">{item.language === "KR" ? "국문" : "영문"}</td><td className="px-3 py-3">{item.version}</td><td className="px-3 py-3 text-slate-500">내장 양식</td><td className="px-3 py-3 text-slate-400">-</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.available ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{item.available ? "기본 사용" : "미등록"}</span></td></tr>)}
      </tbody></table></div>
    </div>
  </section>;
}
