// ponytail: contador em memória, por instância. A 2–5 mil emails/mês o limite
// existe só pra conter loop de produto com bug (reputação SES). Se um dia rodar
// em várias instâncias, trocar por contagem no Postgres.
const hits = new Map<string, number[]>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

export function withinRateLimit(
  key: string,
  { max = MAX_PER_WINDOW, windowMs = WINDOW_MS, now = Date.now() } = {},
): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}
