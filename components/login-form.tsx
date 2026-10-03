"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hasEnvVars } from "@/lib/utils";
import { idleStorageKey } from "@/lib/idle-session";
import { needsMfaChallenge } from "@/lib/mfa-login-policy";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");

  const finishLogin = () => { router.replace("/"); router.refresh(); };
  const handleMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || !factorId || !/^\d{6}$/.test(code)) return;
    setIsLoading(true); setError(null);
    try {
      const auth = createClient().auth;
      const result = await auth.mfa.challengeAndVerify({ factorId, code });
      setCode("");
      if (result.error) throw new Error("인증 실패");
      const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") throw new Error("인증 실패");
      finishLogin();
    } catch { setError("인증 코드를 확인하지 못했습니다. 앱의 최신 코드와 기기 시간을 확인해 주세요."); }
    finally { setIsLoading(false); }
  };
  const cancelMfa = async () => {
    setIsLoading(true); setError(null);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      setFactors([]); setFactorId(""); setCode(""); setPassword("");
    } catch { setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setIsLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnvVars) { setError("Supabase 연결 후 로그인을 사용할 수 있습니다. 현재는 프로토타입 공개 모드입니다."); return; }
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setPassword("");
      if (data.session) {
        try { localStorage.setItem(idleStorageKey(data.session.user.id, data.session.access_token), String(Date.now())); } catch { /* open-tab timer remains available */ }
      }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw new Error("2단계 인증 상태를 확인하지 못했습니다. 다시 로그인해 주세요.");
      if (needsMfaChallenge(assurance.data.currentLevel, assurance.data.nextLevel)) {
        const list = await supabase.auth.mfa.listFactors();
        if (list.error || !list.data.totp.length) throw new Error("인증 앱을 확인하지 못했습니다. 관리자에게 문의해 주세요.");
        setFactors(list.data.totp); setFactorId(list.data.totp[0].id);
        return;
      }
      finishLogin();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">직원 로그인</CardTitle>
          <CardDescription>
            {factors.length ? "인증 앱에 표시되는 6자리 코드를 입력하세요." : "관리자가 초대한 이메일과 직접 설정한 비밀번호를 입력하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {factors.length ? <form onSubmit={handleMfa} className="space-y-4">
            <Label htmlFor="mfa-factor">인증 앱</Label>
            <select id="mfa-factor" disabled={isLoading} className="w-full rounded-md border p-2" value={factorId} onChange={(event) => setFactorId(event.target.value)}>{factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name ?? "인증 앱"}</option>)}</select>
            <Label htmlFor="mfa-code">인증 코드</Label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} disabled={isLoading} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} required pattern="[0-9]{6}" autoFocus/>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" disabled={isLoading || code.length !== 6}>{isLoading ? "확인 중…" : "인증 후 로그인"}</Button>
            <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={cancelMfa}>취소 및 로그아웃</Button>
            <p className="text-xs text-slate-500">인증 앱을 사용할 수 없다면 최고관리자에게 문의하세요. 이 화면에서는 MFA를 초기화하지 않습니다.</p>
          </form> : <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="employee@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">비밀번호</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    비밀번호 재설정
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">신규 계정은 관리자 초대를 통해서만 생성됩니다.</p>
          </form>}
        </CardContent>
      </Card>
    </div>
  );
}
