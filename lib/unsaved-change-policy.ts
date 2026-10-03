export function shouldConfirmLink({ dirty, href, currentHref, target, download, modified }: {
  dirty: boolean; href: string; currentHref: string; target?: string | null; download?: boolean; modified?: boolean;
}) {
  if (!dirty || download || modified || (target && target !== "_self")) return false;
  try {
    const next = new URL(href, currentHref), current = new URL(currentHref);
    if (!["http:", "https:"].includes(next.protocol)) return false;
    return next.origin !== current.origin || next.pathname !== current.pathname || next.search !== current.search;
  } catch { return false; }
}
