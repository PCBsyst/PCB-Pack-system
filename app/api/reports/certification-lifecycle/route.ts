import {requireApiStaff} from "@/lib/server/api-auth";
import {createClient} from "@/lib/supabase/server";
import {currentAuthEnvironment} from "@/lib/supabase/auth-environment";
import {privateDocumentResponse} from "@/lib/private-document-response";
import {readBoundedRows} from "@/lib/bounded-row-reader";
import {buildCertificationLifecycle} from "@/lib/certification-lifecycle";
const fail=(error:string,status:number)=>privateDocumentResponse(Response.json({error},{status}));
export async function GET(request:Request) {
  try {
    const denied=await requireApiStaff();if(denied)return privateDocumentResponse(denied);
    const url=new URL(request.url),keys=["year","area","standard","partner"];
    if(request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)return fail("허용되지 않은 요청입니다.",403);
    if(url.search.length>2048||[...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))return fail("이력 점검 조회 조건을 확인해 주세요.",400);
    const yearValue=url.searchParams.get("year")!,year=Number(yearValue),filters={area:url.searchParams.get("area")!,standard:url.searchParams.get("standard")!,partner:url.searchParams.get("partner")!},asOf=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
    if(!/^\d{4}$/.test(yearValue)||year<1901||year>Number(asOf.slice(0,4))||!["전체","ISO","K_BEAUTY"].includes(filters.area)||Object.values(filters).some(value=>!value||value.length>300||/[\u0000-\u001f\u007f]/.test(value)))return fail("비교 연도와 조회 조건을 확인해 주세요.",400);
    if(currentAuthEnvironment().localPrototype)return fail("공유 DB가 연결되지 않았습니다. 상단 가상 비교 예제를 이용하세요.",503);
    const client=await createClient();
    const tables=[
      ["applications","id,candidate_id,received_at,business_area,partner_name_snapshot,status",10000],
      ["jobs","id,application_id,candidate_id,standard,grade,previous_job_id",50000],
      ["processing_cycles","id,job_id,application_type",50000],
      ["certification_records","id,job_id,cycle_id,issue_date,valid_from,valid_until,state,history_state,replaced_record_id",50000],
      ["certification_actions","id,job_id,certification_record_id,action_type,effective_date",50000],
    ] as const;
    const results:unknown[]=[];
    for(const [table,columns,limit] of tables){const rows=await readBoundedRows((from,to)=>client.from(table).select(columns,{count:"exact"}).order("id").range(from,to),row=>(row as unknown as {id?:unknown})?.id,()=>request.signal.aborted,limit);if(!rows)return fail("이력 조회가 중단됐습니다.",408);results.push(rows);}
    const report=buildCertificationLifecycle(results[0],results[1],results[2],results[3],results[4],year,filters,asOf),body=JSON.stringify(report);
    return privateDocumentResponse(new Response(body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Report-Bytes":String(new TextEncoder().encode(body).length)}}));
  }catch{return fail("인증 이력의 전체 조회·날짜·구성을 확인하지 못했습니다. 관련 테이블·연결 필드와 권한을 확인해 주세요. 실패를 0건으로 표시하지 않습니다.",503);}
}
