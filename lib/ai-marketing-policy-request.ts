import {boundedDownloadBlob} from "@/lib/bounded-download";
import {documentErrorMessage} from "@/lib/document-errors";
import {readAiPolicyView,type aiPolicyInput} from "@/lib/ai-marketing-policy";
export async function requestAiPolicy(signal:AbortSignal,input?:ReturnType<typeof aiPolicyInput>) {
  const response=await fetch("/api/settings/ai-marketing-policy",{method:input?"POST":"GET",credentials:"same-origin",cache:"no-store",signal,...(input?{headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}:{})});
  if(!response.ok)throw Error(await documentErrorMessage(response));
  if(!response.headers.get("Content-Type")?.startsWith("application/json"))throw Error("AI 정책 응답 형식 오류");
  const blob=await boundedDownloadBlob(response,Number(response.headers.get("X-Report-Bytes")),128*1024);
  return readAiPolicyView(JSON.parse(await blob.text()));
}
