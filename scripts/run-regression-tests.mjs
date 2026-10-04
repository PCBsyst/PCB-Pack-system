import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));
const tests = readdirSync(directory).filter((name) => /^test-.+\.mjs$/.test(name)).sort();
if (tests.length === 0) {
  console.error("자동검사 파일이 없어 빌드를 중단합니다.");
  process.exit(1);
}
const failures = [];
for (const test of tests) {
  console.log(`\n검사: ${test}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(test, import.meta.url))], {
    cwd: root, stdio: "inherit", timeout: 60_000,
  });
  if (result.error || result.status !== 0) {
    failures.push(test);
    console.error(result.error?.code === "ETIMEDOUT" ? "검사 제한 시간 초과" : "검사 실패");
  }
}
console.log(`\n자동검사 ${tests.length}개: 성공 ${tests.length - failures.length}개, 실패 ${failures.length}개`);
if (failures.length) {
  console.error(`실패한 검사:\n${failures.join("\n")}`);
  process.exit(1);
}
