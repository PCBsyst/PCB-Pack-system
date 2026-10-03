import assert from "node:assert/strict";
import { getAuthEnvironment } from "../lib/supabase/auth-environment.ts";

for (const nodeEnv of ["development", "production", "test", undefined]) {
  for (const vercel of [undefined, "1"]) {
    for (const [url, key] of [[undefined, undefined], ["https://example.supabase.co", undefined], [undefined, "key"], [" ", " "]]) {
      const result = getAuthEnvironment({ url, key, nodeEnv, vercel });
      const allowDemo = nodeEnv === "development" && !vercel;
      assert.equal(result.localPrototype, allowDemo);
      assert.equal(result.blocked, !allowDemo);
    }
    const ready = getAuthEnvironment({ url: "https://example.supabase.co", key: "key", nodeEnv, vercel });
    assert.equal(ready.configured, true);
    assert.equal(ready.localPrototype, false);
    assert.equal(ready.blocked, false);
  }
}
console.log("Auth environment: 40 cases passed");
