import type { DocumentLanguage, PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { boundedDownloadBlob } from "@/lib/bounded-download";
import { documentErrorMessage } from "@/lib/document-errors";
import { decisionHtmlVersion } from "@/lib/decision-report-html";

export async function fetchDecisionReportHtml(context:PackageContext,job:Job,language:DocumentLanguage,signal?:AbortSignal) {
  const response = await fetch("/api/documents/decision-report-html",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,job,language}),signal});
  if (!response.ok) throw new Error(await documentErrorMessage(response));
  const hash = response.headers.get("X-Report-SHA256") ?? "", size = Number(response.headers.get("X-Report-Bytes"));
  if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("text/html") || response.headers.get("X-Report-Version") !== decisionHtmlVersion || response.headers.get("X-Report-Status") !== "DESIGN_PREVIEW" || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("HTML 보고서 응답 형식과 버전을 확인하지 못했습니다.");
  const blob = await boundedDownloadBlob(response,size,5*1024*1024);
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
  if (actual !== hash) throw new Error("HTML 보고서 무결성 확인에 실패했습니다.");
  const html = await blob.text();
  if (!html.startsWith("<!doctype html>") || !html.includes('name="report-template"') || /<script\b|<iframe\b|<form\b/i.test(html)) throw new Error("안전한 HTML 보고서 구성을 확인하지 못했습니다.");
  return {html,blob,hash,fileName:`${job.jobNo.replace(/[^A-Za-z0-9_-]/g,"_")}_Decision_Review_${language}.html`};
}
