import {numberingRules} from "@/lib/numbering-rules";
import type {CustomerAcquisitionReport} from "@/lib/customer-acquisition";
export const aiMarketingPrivacyVersion="AI-MKT-PREVIEW-01";
const known=new Map<string,string>(),codes=new Map<string,string>();
for(const rule of numberingRules){const key=JSON.stringify([rule.businessArea,rule.field]),code=`${rule.businessArea}:${rule.jobPrefix}`;if(!rule.verified||known.has(key)||!/^(ISO|K_BEAUTY):[A-Z0-9-]{1,24}$/.test(code)||codes.has(code)&&codes.get(code)!==key)continue;known.set(key,code);codes.set(code,key);}
const band=(count:number)=>({min:Math.floor(count/5)*5,max:Math.floor(count/5)*5+4});
/** Review only. No provider request is implemented, even if credentials exist. */
export function buildAiMarketingPrivacyPreview(report:CustomerAcquisitionReport,source:"INTERNAL_AGGREGATE"|"SYNTHETIC"="INTERNAL_AGGREGATE") {
  const year=Number(report.asOf.slice(0,4))-1,period=report.marketSignals.period;
  if(report.year!==year||Object.values(report.filters).some(value=>value!=="전체")||period.currentStart!==`${year}-01-01`||period.currentEnd!==`${year}-12-31`||period.previousStart!==`${year-1}-01-01`||period.previousEnd!==`${year-1}-12-31`)throw Error("보호 미리보기는 직전 마감 연도의 전체 조건으로만 만듭니다.");
  const records:Array<{standardCode:string;previousBand:{min:number;max:number};currentBand:{min:number;max:number}}>=[];
  let smallGroups=0,unapprovedCodes=0;
  for(const row of report.marketSignals.standards){
    const code=known.get(JSON.stringify([row.area,row.standard]));
    if(!code){unapprovedCodes++;continue;}
    if(!Number.isSafeInteger(row.previousCustomers)||!Number.isSafeInteger(row.currentCustomers)||row.previousCustomers<0||row.currentCustomers<0)throw Error("집계값 형식을 확인하지 못했습니다.");
    if(row.previousCustomers<5||row.currentCustomers<5){smallGroups++;continue;}
    records.push({standardCode:code,previousBand:band(row.previousCustomers),currentBand:band(row.currentCustomers)});
  }
  const payload=records.length?{policyVersion:aiMarketingPrivacyVersion,source,metric:"RECORDED_RECEIPT_CUSTOMERS" as const,period:{previousYear:year-1,currentYear:year},historyCoverage:"UNVERIFIED" as const,unavailableMetrics:["NEW_CUSTOMERS","RETENTION","RENEWAL","HISTORICAL_GRADE"] as const,records}:null;
  return {version:aiMarketingPrivacyVersion,externalTransmissionEnabled:false as const,reviewOnly:true as const,status:payload?"REVIEW_REQUIRED" as const:"NO_ELIGIBLE_GROUPS" as const,
    source,year,excluded:{smallGroups,unapprovedCodes},payload};
}
export type AiMarketingPrivacyPreview=ReturnType<typeof buildAiMarketingPrivacyPreview>;
export function readAiMarketingPrivacyPreview(value:unknown):AiMarketingPrivacyPreview {
  const result=value as AiMarketingPrivacyPreview;
  const only=(v:unknown,allowed:string[])=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===allowed.length&&Object.keys(v).every(key=>allowed.includes(key));
  const int=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
  if(!only(result,["version","externalTransmissionEnabled","reviewOnly","status","source","year","excluded","payload"])||result.version!==aiMarketingPrivacyVersion||result.externalTransmissionEnabled!==false||result.reviewOnly!==true||!["INTERNAL_AGGREGATE","SYNTHETIC"].includes(result.source)||!Number.isInteger(result.year)||result.year<1901||!only(result.excluded,["smallGroups","unapprovedCodes"])||![result.excluded.smallGroups,result.excluded.unapprovedCodes].every(int))throw Error("AI 보호 미리보기 기준을 확인하지 못했습니다.");
  if(result.status==="NO_ELIGIBLE_GROUPS"){if(result.payload!==null)throw Error("보호 대상 없음 응답 오류");return result;}
  const p=result.payload;
  if(result.status!=="REVIEW_REQUIRED"||!only(p,["policyVersion","source","metric","period","historyCoverage","unavailableMetrics","records"])||!p||p.policyVersion!==aiMarketingPrivacyVersion||p.source!==result.source||p.metric!=="RECORDED_RECEIPT_CUSTOMERS"||p.historyCoverage!=="UNVERIFIED"||!only(p.period,["previousYear","currentYear"])||p.period.currentYear!==result.year||p.period.previousYear!==result.year-1||JSON.stringify(p.unavailableMetrics)!==JSON.stringify(["NEW_CUSTOMERS","RETENTION","RENEWAL","HISTORICAL_GRADE"])||!Array.isArray(p.records)||!p.records.length||p.records.length>100)throw Error("허용된 집계 전용 구성을 확인하지 못했습니다.");
  const seen=new Set<string>();
  for(const row of p.records){if(!only(row,["standardCode","previousBand","currentBand"])||!codes.has(row.standardCode)||seen.has(row.standardCode))throw Error("허용되지 않은 표준·필드가 포함됐습니다.");seen.add(row.standardCode);for(const b of [row.previousBand,row.currentBand])if(!only(b,["min","max"])||!int(b.min)||!int(b.max)||b.min<5||b.min%5!==0||b.max!==b.min+4)throw Error("작은 집단 또는 정확 인원이 포함됐습니다.");}
  return result;
}
