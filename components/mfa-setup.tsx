"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; status: string; friendly_name?: string };
type Setup = { id: string; qr: string; secret: string };

export function MfaSetup({ prototype }: { prototype: boolean }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [level, setLevel] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (prototype) return;
    let active = true;
    const auth = createClient().auth;
    void Promise.all([auth.mfa.listFactors(), auth.mfa.getAuthenticatorAssuranceLevel()]).then(([list, assurance]) => {
      if (!active) return;
      if (list.error || assurance.error) { setMessage("인증 상태를 불러오지 못했습니다. 페이지를 새로고침해 주세요."); return; }
      const totp = list.data.all.filter((factor) => factor.factor_type === "totp");
      setFactors(totp); setFactorId(totp[0]?.id ?? "");
      setLevel(assurance.data.currentLevel ?? "aal1"); setLoaded(true);
    }).catch(() => { if (active) setMessage("인증 서버에 연결하지 못했습니다."); });
    return () => { active = false; };
  }, [prototype]);

  async function enroll() {
    if (busy || !loaded || factors.length) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await createClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "직원 인증 앱" });
      if (error) { setMessage("인증 앱 등록을 시작하지 못했습니다. 계정 상태를 확인해 주세요."); return; }
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setFactorId(data.id); setFactors([{ id: data.id, status: "unverified", friendly_name: "직원 인증 앱" }]);
    } catch { setMessage("인증 서버에 연결하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
      setCode("");
      if (error) { setMessage("코드를 확인하지 못했습니다. 인증 앱의 최신 6자리 코드와 기기 시간을 확인해 주세요."); return; }
      setSetup(null); setLevel("aal2");
      setFactors((items) => items.map((item) => item.id === factorId ? { ...item, status: "verified" } : item));
      setMessage("인증 코드 확인이 완료되었습니다. 현재 로그인 세션은 2단계 인증을 완료했습니다.");
    } catch { setMessage("인증 서버에 연결하지 못했습니다."); }
    finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 p-3 text-sm";
  return <section className="max-w-2xl space-y-5 rounded-xl border bg-white p-6">
    <div><h2 className="text-lg font-semibold">인증 앱 연결</h2><p className="mt-2 text-sm text-slate-600">Google Authenticator 또는 Microsoft Authenticator 등에서 QR 코드를 등록한 뒤 6자리 코드를 입력하세요. QR 코드와 설정 키는 다른 사람에게 공유하지 마세요.</p></div>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">등록된 인증 앱은 비밀번호 로그인 다음 단계에서 확인합니다. 업무 페이지·API·DB 전체의 MFA 강제 적용과 15일 신뢰 기기는 아직 활성화되지 않았습니다.</p>
    {prototype ? <p>로컬 가상데이터 모드에서는 실제 인증 앱을 등록하지 않습니다.</p> : <>
      <p className="text-sm">현재 세션: {level === "aal2" ? "2단계 인증 완료" : loaded ? "기본 로그인" : "확인 중"}</p>
      {!factors.length && <button disabled={!loaded || busy} onClick={enroll} className="rounded-lg bg-blue-800 px-4 py-2 text-white disabled:opacity-50">인증 앱 등록 시작</button>}
      {setup && <div className="space-y-3 rounded-lg border p-4">
        {/* Supabase가 반환한 SVG를 이미지로 표시하며 HTML로 삽입하지 않습니다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr.startsWith("data:image/svg+xml") ? setup.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr)}`} width={220} height={220} alt="인증 앱 등록용 QR 코드"/>
        <details><summary className="cursor-pointer text-sm">QR을 스캔할 수 없다면 설정 키 보기</summary><p className="mt-2 break-all font-mono text-sm">{setup.secret}</p></details>
        <p className="text-sm text-slate-600">완료 전에 이 페이지를 벗어나면 QR과 설정 키를 다시 볼 수 없습니다. 먼저 인증 앱에 저장하세요.</p>
      </div>}
      {factors.length > 0 && <form onSubmit={verify} className="space-y-3">
        <label className="block text-sm">인증 앱<select disabled={busy} className={inputClass} value={factorId} onChange={(e) => setFactorId(e.target.value)}>{factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name ?? "인증 앱"} · {factor.status === "verified" ? "등록 완료" : "코드 확인 대기"}</option>)}</select></label>
        {!setup && factors.some((factor) => factor.status !== "verified") && <p className="text-sm text-slate-600">이전에 연결한 앱의 코드를 입력하세요. 앱에 저장하지 못했다면 최고관리자에게 복구를 요청하세요. 관리자 복구 기능은 후속 단계로 준비됩니다.</p>}
        <label className="block text-sm">6자리 인증 코드<input className={inputClass} value={code} disabled={busy} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required pattern="[0-9]{6}"/></label>
        <button disabled={busy || code.length !== 6} className="rounded-lg bg-blue-800 px-4 py-2 text-white disabled:opacity-50">{busy ? "확인 중…" : "인증 코드 확인"}</button>
      </form>}
    </>}
    <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
    <p className="text-xs text-slate-500">설정 키와 인증 코드는 이 화면에서만 사용하며 업무 기록이나 브라우저 저장소에 보관하지 않습니다. 인증 앱 삭제·초기화 기능은 제공하지 않습니다.</p>
  </section>;
}
