import {GET as customerAcquisitionReport} from "@/app/api/reports/customer-acquisition/route";
import {readCustomerAcquisitionReport,allAcquisitionFilters} from "@/lib/customer-acquisition";
import {buildAiMarketingPrivacyPreview} from "@/lib/ai-marketing-privacy";
import {privateDocumentResponse} from "@/lib/private-document-response";
import {requireApiStaff} from "@/lib/server/api-auth";
export async function GET(request:Request) {
  try {
    const denied=await requireApiStaff();if(denied)return privateDocumentResponse(denied);
    const url=new URL(request.url);
    if(url.search)return privateDocumentResponse(Response.json({error:"보호 미리보기에는 임의 연도·세부 필터를 적용하지 않습니다."},{status:400}));
    const asOf=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}),year=Number(asOf.slice(0,4))-1;
    const source=new URL("/api/reports/customer-acquisition",url.origin);source.search=new URLSearchParams({year:String(year),...allAcquisitionFilters}).toString();
    // Internal function call, not a network request; source handler checks staff/session/MFA and re-queries DB.
    const response=await customerAcquisitionReport(new Request(source,{headers:request.headers,signal:request.signal}));
    if(!response.ok)return privateDocumentResponse(response);
    const report=readCustomerAcquisitionReport(await response.json(),year,allAcquisitionFilters);
    const body=JSON.stringify(buildAiMarketingPrivacyPreview(report));
    return privateDocumentResponse(new Response(body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Report-Bytes":String(new TextEncoder().encode(body).length)}}));
  }catch{return privateDocumentResponse(Response.json({error:"AI 보호 미리보기의 집계와 구성을 확인하지 못했습니다. 외부 전송은 하지 않았습니다."},{status:503}));}
}
