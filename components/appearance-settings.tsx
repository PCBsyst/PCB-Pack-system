"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <section className="rounded-xl border bg-white p-6">
    <h3 className="font-semibold">화면 모드</h3>
    <p className="mt-2 text-sm text-slate-500">선택 즉시 전체 화면에 적용됩니다. 이 브라우저에 저장되며 다른 직원의 화면이나 문서 출력에는 영향을 주지 않습니다.</p>
    <fieldset disabled={!mounted} className="mt-5 grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">화면 모드 선택</legend>
      {[{ value: "dark", label: "다크모드", icon: Moon }, { value: "light", label: "화이트 모드", icon: Sun }].map(({ value, label, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${mounted && theme === value ? "ring-2 ring-blue-500" : ""}`}>
        <input type="radio" name="appearance-theme" value={value} checked={mounted && theme === value} onChange={() => setTheme(value)}/>
        <Icon className="h-5 w-5"/><span className="text-sm font-semibold">{label}</span>
      </label>)}
    </fieldset>
  </section>;
}
