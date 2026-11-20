import {boundedDownloadBlob} from "@/lib/bounded-download";
import {documentErrorMessage} from "@/lib/document-errors";
import {readCertificationLifecycle} from "@/lib/certification-lifecycle";
import type {AcquisitionFilters} from "@/lib/customer-acquisition";
export async function fetchCertificationLifecycle(year:number,filters:AcquisitionFilters,signal:AbortSignal) {
  const response=await fetch(`/api/reports/certification-lifecycle?${new URLSearchParams({year:String(year),...filters})}`,{credentials:"same-origin",cache:"no-store",signal});
  if(!response.ok)throw Error(await documentErrorMessage(response));
  if(!response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))throw Error("인증 이력 응답 형식을 확인하지 못했습니다.");
  const blob=await boundedDownloadBlob(response,Number(response.headers.get("X-Report-Bytes")),256*1024);
  return readCertificationLifecycle(JSON.parse(await blob.text()),year,filters);
}
