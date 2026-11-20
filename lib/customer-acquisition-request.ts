import {boundedDownloadBlob} from "@/lib/bounded-download";
import {documentErrorMessage} from "@/lib/document-errors";
import {readCustomerAcquisitionReport,type AcquisitionFilters} from "@/lib/customer-acquisition";
export async function fetchCustomerAcquisition(year:number,filters:AcquisitionFilters,signal:AbortSignal) {
  const params=new URLSearchParams({year:String(year),...filters});
  const response=await fetch(`/api/reports/customer-acquisition?${params}`,{credentials:"same-origin",cache:"no-store",signal});
  if(!response.ok)throw Error(await documentErrorMessage(response));
  if(!response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))throw Error("비교 응답 형식을 확인하지 못했습니다.");
  const blob=await boundedDownloadBlob(response,Number(response.headers.get("X-Report-Bytes")),256*1024);
  return readCustomerAcquisitionReport(JSON.parse(await blob.text()),year,filters);
}
