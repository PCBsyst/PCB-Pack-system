import {boundedDownloadBlob} from "@/lib/bounded-download";
import {documentErrorMessage} from "@/lib/document-errors";
import {readAiMarketingPrivacyPreview} from "@/lib/ai-marketing-privacy";
export async function fetchAiMarketingPreview(signal:AbortSignal) {
  const response=await fetch("/api/reports/ai-marketing-preview",{credentials:"same-origin",cache:"no-store",signal});
  if(!response.ok)throw Error(await documentErrorMessage(response));
  if(!response.headers.get("Content-Type")?.startsWith("application/json"))throw Error("보호 미리보기 형식을 확인하지 못했습니다.");
  const blob=await boundedDownloadBlob(response,Number(response.headers.get("X-Report-Bytes")),128*1024),result=readAiMarketingPrivacyPreview(JSON.parse(await blob.text()));
  if(result.source!=="INTERNAL_AGGREGATE")throw Error("서버 자료와 가상 예제를 구분하지 못했습니다.");
  return result;
}
