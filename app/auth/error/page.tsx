import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-muted-foreground">
          {params.error === "approval-required" || params.error === "inactive"
            ? "이 계정은 승인 대기 또는 비활성 상태입니다. 최고관리자에게 계정 활성화를 요청해 주세요."
            : params.error === "verification-unavailable" ? "인증 서버에서 보안 상태를 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요." : `인증 처리 오류: ${params.error}`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          인증 상태를 확인하지 못했습니다. 다시 로그인해 주세요.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                계정 접근 안내
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
