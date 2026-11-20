import { requireApiStaff } from "@/lib/server/api-auth";
import { createClient } from "@/lib/supabase/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { readBoundedRows } from "@/lib/bounded-row-reader";
import { normalizeAcquisitionRecords,buildCustomerAcquisition } from "@/lib/customer-acquisition";
const failure=(error:string,status:number)=>privateDocumentResponse(Response.json({error},{status}));
export async function GET(request:Request) {
  try {
    const denied=await requireApiStaff();if(denied)return privateDocumentResponse(denied);
    const url=new URL(request.url),origin=request.headers.get("Origin");
    if(origin&&origin!==url.origin)return failure("허용되지 않은 요청입니다.",403);
    const keys=["year","area","standard","partner"];
    if(url.search.length>2048||[...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))return failure("비교 조회 조건을 확인해 주세요.",400);
    const yearValue=url.searchParams.get("year")!,year=Number(yearValue),filters={area:url.searchParams.get("area")!,standard:url.searchParams.get("standard")!,partner:url.searchParams.get("partner")!};
    const asOf=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
    if(!/^\d{4}$/.test(yearValue)||year<1901||year>Number(asOf.slice(0,4))||Object.values(filters).some(v=>!v||v.length>300||/[\u0000-\u001f\u007f]/.test(v))||!["전체","ISO","K_BEAUTY"].includes(filters.area))return failure("비교 연도와 조회 조건을 확인해 주세요.",400);
    if(currentAuthEnvironment().localPrototype)return failure("공유 DB가 연결되지 않았습니다. 가상 예제로 확인해 주세요.",503);
    const client=await createClient();
    // Separate paged tables preserve Job-less applications and avoid embedded-relation row caps.
    const applications=await readBoundedRows((from,to)=>client.from("applications").select("id,candidate_id,received_at,business_area,partner_name_snapshot,status",{count:"exact"}).order("id").range(from,to),row=>row?.id,()=>request.signal.aborted);
    if(!applications)return failure("조회가 중단됐습니다.",408);
    const jobs=await readBoundedRows((from,to)=>client.from("jobs").select("id,application_id,candidate_id,standard,grade",{count:"exact"}).order("id").range(from,to),row=>row?.id,()=>request.signal.aborted,50000);
    if(!jobs||request.signal.aborted)return failure("조회가 중단됐습니다.",408);
    const records=normalizeAcquisitionRecords(applications,jobs);
    const body=JSON.stringify(buildCustomerAcquisition(records.applications,records.jobs,year,filters,asOf));
    // Internal aggregate only: no customer identifiers, names, file text or external AI calls.
    return privateDocumentResponse(new Response(body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Report-Bytes":String(new TextEncoder().encode(body).length)}}));
  } catch {return failure("비교 자료의 전체 조회와 연결을 확인하지 못했습니다. 일부 자료를 0건으로 간주하지 않습니다.",503);}
}
