type AuthEnvironment = { url?: string; key?: string; nodeEnv?: string; vercel?: string };

export function getAuthEnvironment({ url, key, nodeEnv, vercel }: AuthEnvironment) {
  const configured = Boolean(url?.trim() && key?.trim());
  // Never permit a deployed/production server to silently become a demo administrator.
  const localPrototype = !configured && nodeEnv === "development" && !vercel;
  return { configured, localPrototype, blocked: !configured && !localPrototype };
}

export function currentAuthEnvironment() {
  return getAuthEnvironment({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  });
}
