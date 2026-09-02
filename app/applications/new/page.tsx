import Link from "next/link";
import { ArrowLeft, FolderPlus, Plus, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";

export default function NewApplicationPage() {
  return <AppShell title="신규 신청 등록" description="대표메일 최초 수신일을 공식 접수일로 기록하고 세부 분야별 관리 No.와 Job No.를 확정합니다.">
    <div className="max-w-5xl"><Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4"/>신청 목록으로</Link>
      <form className="space-y-5">
        <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">접수 기본정보</h2><p className="mt-1 text-sm text-slate-500">최초 자료가 대표메일에 도착한 날짜를 접수일로 사용합니다.</p></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="공식 접수일" required><input type="date" className={controlClass} defaultValue="2026-09-02"/></Field><Field label="후보자" required><select className={controlClass}><option>홍길동</option><option>김철수</option><option>이영희</option></select></Field><Field label="발행 분야" required><select className={controlClass}><option>ISO 경영시스템 심사원</option><option>K-Beauty 전문가 자격</option></select></Field><Field label="인정 구분" required><select className={controlClass}><option>인정</option><option>비인정</option></select></Field><Field label="신청구분" required><select className={controlClass}><option>최초</option><option>갱신</option><option>등급변경</option><option>기타</option></select></Field><Field label="파트너사"><select className={controlClass}><option>직접접수</option><option>한국품질파트너스</option><option>케이뷰티전문가연합회</option></select></Field></div></section>
        <section className="rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="font-semibold">신청 세부 분야</h2><p className="mt-1 text-sm text-slate-500">각 분야에 관리 No.와 Job No.가 별도로 부여됩니다.</p></div><Button type="button" variant="outline"><Plus/>분야 추가</Button></div><div className="p-6"><div className="grid gap-4 rounded-lg border bg-slate-50 p-4 sm:grid-cols-4"><Field label="세부 분야"><select className={controlClass}><option>ISO 9001</option><option>ISO 14001</option><option>ISO 45001</option></select></Field><Field label="등급"><select className={controlClass}><option>Auditor</option><option>Lead Auditor</option><option>Provisional Auditor</option></select></Field><Field label="관리 No."><input className={controlClass} value="1295" readOnly/></Field><Field label="예상 Job No."><input className={controlClass} value="QMS261295" readOnly/></Field></div></div></section>
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><FolderPlus className="mt-0.5 h-5 w-5 text-blue-800"/><div><p className="font-semibold text-blue-950">권장 Dropbox 폴더명</p><p className="mt-2 rounded-md bg-white px-4 py-3 font-mono text-sm text-slate-800">1295 홍길동 (A 9001 최초)</p><p className="mt-2 text-xs text-blue-700">현재는 폴더명을 복사해 수동 생성하고, 향후 Dropbox 연결 시 버튼으로 생성할 수 있습니다.</p></div></div></section>
        <div className="flex justify-end gap-2"><Button variant="outline" asChild><Link href="/applications">취소</Link></Button><Button type="button" className="bg-blue-800 hover:bg-blue-900"><Save/>번호 확정 및 신청 등록</Button></div>
      </form>
    </div>
  </AppShell>;
}
