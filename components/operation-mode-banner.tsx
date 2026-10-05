"use client";
import {useOperationMode} from "@/components/use-operation-mode";
import {operationOptions} from "@/lib/operation-mode";
export function OperationModeBanner(){const result=useOperationMode();if(result.mode!=="ready"||!result.policy.active)return null;const policy=result.policy;const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul"}).format(new Date());return <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-950" role="status"><strong>이관·테스트 운영 중</strong> · 중지: {policy.paused.map(id=>operationOptions.find(item=>item.id===id)?.label).join(" · ")||"없음"} · 종료 예정 {policy.endsOn}{policy.endsOn&&today>=policy.endsOn&&" · 최고관리자 복구 점검 필요"}<p className="mt-1 text-xs">보안·이력·백업은 유지됩니다. 복구 시 밀린 발송이나 날짜 재계산은 실행하지 않습니다.</p></div>;}
