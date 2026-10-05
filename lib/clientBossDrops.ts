import type { BossDropsResponse } from "./bossTypes";

const responses = new Map<string, { value: BossDropsResponse; expiresAt: number }>();
const pending = new Map<string, Promise<BossDropsResponse>>();

export function loadBossDrops(slug: string, refresh = false): Promise<BossDropsResponse> {
  const cached = responses.get(slug);
  if (!refresh && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  const running = pending.get(slug);
  if (running) return running;
  const request = fetch(`/api/bosses/${encodeURIComponent(slug)}/drops`, { cache: refresh ? "no-store" : "default" })
    .then(async (response) => {
      const payload = await response.json() as BossDropsResponse & { error?: string };
      if (!response.ok || payload.error || !Array.isArray(payload.data) || !payload.meta) {
        throw new Error("Unable to load boss drops. Please try again.");
      }
      responses.set(slug, { value: payload, expiresAt: Date.now() + 60_000 });
      return payload;
    })
    .finally(() => pending.delete(slug));
  pending.set(slug, request);
  return request;
}
