export function safeCallbackUrl(value?: string): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const base = new URL("http://merchvision.local");
    const target = new URL(value, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : "/";
  } catch {
    return "/";
  }
}
