"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";

export function StaffInviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="rounded-lg border bg-white p-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/staff/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
      const result = await response.json();
      setMessage(result.error ?? result.message);
      if (response.ok) { setName(""); setEmail(""); }
    } catch { setMessage("요청에 실패했습니다. 네트워크 연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }}>
    <p className="mb-4 text-sm text-slate-600">직원은 비밀번호 설정 후 승인 대기로 등록됩니다. 계정 활성화와 서브 관리자 지정은 최고관리자만 수행합니다.</p>
    <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]"><input aria-label="직원 이름" required maxLength={100} className={controlClass} placeholder="직원 이름" value={name} onChange={(event) => setName(event.target.value)}/><input aria-label="직원 이메일" required type="email" maxLength={254} className={controlClass} placeholder="직원 이메일" value={email} onChange={(event) => setEmail(event.target.value)}/><Button disabled={busy}>{busy ? "발송 중…" : "초대 이메일 발송"}</Button></div>
    {message && <p role="status" className="mt-4 text-sm text-blue-900">{message}</p>}
  </form>;
}
