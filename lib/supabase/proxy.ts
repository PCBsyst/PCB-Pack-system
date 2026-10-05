import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { checkServerMfa } from "@/lib/server/mfa-access";
import { readStaffSession } from "@/lib/staff-session";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const environment = currentAuthEnvironment();
  if (environment.blocked) {
    return NextResponse.json(
      { error: "인증 서버 설정이 누락되어 접근을 중단했습니다. 최고관리자에게 문의해주세요." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (environment.localPrototype) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const finish = (response: NextResponse) => {
    // Preserve refreshed auth cookies on denials and redirects as well.
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  if (user && !request.nextUrl.pathname.startsWith("/auth")) {
    const { data: profile, error } = await supabase.from("profiles").select("active,is_owner").eq("id", user.sub).maybeSingle();
    if (error) return finish(NextResponse.json({ error: "직원 권한을 확인하지 못했습니다." }, { status: 503 }));
    if (!profile?.active) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return finish(NextResponse.json({ error: "최고관리자의 계정 활성화 승인이 필요합니다." }, { status: 403 }));
      }
      const url = request.nextUrl.clone();
      url.pathname = "/auth/error";
      url.search = "?error=approval-required";
      return finish(NextResponse.redirect(url));
    }
    const session = await readStaffSession(supabase);
    if (session === "unavailable") return finish(NextResponse.json({ error: "서버 세션 상태를 확인하지 못했습니다.", code: "SESSION_UNAVAILABLE" }, { status: 503 }));
    if (session === "invalid") {
      if (request.nextUrl.pathname.startsWith("/api/")) return finish(NextResponse.json({ error: "종료된 세션입니다. 다시 로그인해 주세요.", code: "SESSION_ENDED" }, { status: 401 }));
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.search = "?reason=session-ended";
      return finish(NextResponse.redirect(url));
    }
    const mfa = await checkServerMfa(supabase, user.sub, user.aal, profile.is_owner === true);
    if (mfa !== "allow") {
      if (request.nextUrl.pathname.startsWith("/api/") || mfa === "unavailable") {
        return finish(NextResponse.json({ error: mfa === "unavailable" ? "2단계 인증 상태를 확인하지 못했습니다." : "내 계정 보안에서 2단계 인증을 완료해 주세요.", code: mfa === "unavailable" ? "MFA_UNAVAILABLE" : "MFA_REQUIRED" }, { status: mfa === "unavailable" ? 503 : 403 }));
      }
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa";
      url.search = "";
      return finish(NextResponse.redirect(url));
    }
  }

  if (!user && !request.nextUrl.pathname.startsWith("/auth")) {
    if (request.nextUrl.pathname.startsWith("/api/")) return finish(NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }));
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return finish(NextResponse.redirect(url));
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return finish(supabaseResponse);
}
