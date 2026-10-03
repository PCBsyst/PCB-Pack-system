"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, controlClass } from "@/components/form-fields";

export function StaffIdentityEditor({ user, isOwner, onSaved, onCancel }: {
  user: { id: string; name: string; email: string };
  isOwner: boolean;
  onSaved: (name: string, email: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="mt-4 space-y-4 rounded-lg border bg-slate-50 p-4" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    if (email.trim().toLowerCase() !== user.email && !window.confirm("로그인 이메일이 즉시 변경됩니다. 주소를 정확히 확인하셨나요?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff/identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, name, email, reason }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "저장하지 못했습니다."); return; }
      onSaved(data.name, data.email);
    } catch { setError("서버에 연결하지 못했습니다. 새로고침 후 저장 여부를 확인해주세요."); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold">직원정보 수정 · {user.name}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="직원 이름"><input required maxLength={100} disabled={busy} className={controlClass} value={name} onChange={(event) => setName(event.target.value)}/></Field>
      <Field label="로그인 이메일"><input required type="email" maxLength={254} disabled={busy || isOwner} className={controlClass} value={email} onChange={(event) => setEmail(event.target.value)}/></Field>
    </div>
    <p className="text-xs text-slate-600">이메일 변경은 확인메일 없이 즉시 적용됩니다. 주소를 직원과 확인해주세요. 비밀번호·역할·활성상태는 유지됩니다. 최고관리자 본인의 이메일은 여기서 변경할 수 없습니다.</p>
    <Field label="변경 사유 (필수)"><input required maxLength={1000} disabled={busy} className={controlClass} value={reason} onChange={(event) => setReason(event.target.value)}/></Field>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>취소</Button><Button type="submit" disabled={busy}>{busy ? "저장 중…" : "직원정보 저장"}</Button></div>
  </form>;
}
