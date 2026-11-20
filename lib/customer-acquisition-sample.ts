import { normalizeAcquisitionRecords } from "@/lib/customer-acquisition";
export function customerAcquisitionSample() {
  const apps=[
    ["old","c1","2024-12-10"],["previous","c2","2025-01-05"],["jobless","c3","2025-01-08"],
    ["extra","c1","2026-01-05"],["repeat","c2","2026-01-06"],["new","c4","2026-01-10"],
    ["november","c5","2026-11-10"],["future","c6","2026-11-25"],["cancelled","c7","2025-01-02"],
  ].map(([id,candidate_id,received_at])=>({id,candidate_id,received_at,business_area:"ISO",partner_name_snapshot:"직접접수",status:id==="cancelled"?"CANCELLED":"DOCUMENT_REVIEW"}));
  const jobs=apps.filter(row=>row.id!=="jobless").flatMap(app=>(app.id==="new"?["ISO 9001","ISO 14001"]:[app.id==="extra"?"ISO 14001":"ISO 9001"]).map((standard,index)=>({id:`${app.id}-${index}`,application_id:app.id,candidate_id:app.candidate_id,standard,grade:"Auditor"})));
  return normalizeAcquisitionRecords(apps,jobs);
}
