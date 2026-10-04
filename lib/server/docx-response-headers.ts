import "server-only";
import { createHash } from "node:crypto";

export function docxOutputHeaders(bytes: Uint8Array) {
  return {
    "X-Document-SHA256": createHash("sha256").update(bytes).digest("hex"),
    "X-Document-Byte-Size": String(bytes.byteLength),
  };
}
