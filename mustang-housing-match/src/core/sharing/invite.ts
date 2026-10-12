/** Invitation Link: `<base>#list=<listId>&t=<token>`; the join box also accepts the bare `<listId>.<token>` code. */
export function buildInviteLink(base: string, listId: string, token: string): string {
  const b = base.endsWith("/") || base.includes("#") ? base : base + "/";
  return `${b}#list=${encodeURIComponent(listId)}&t=${encodeURIComponent(token)}`;
}

export function buildInviteCode(listId: string, token: string): string {
  return `${listId}.${token}`;
}

export function parseInvite(input: string): { listId: string; token: string } | null {
  const s = input.trim();
  if (!s) return null;
  const hash = s.includes("#") ? s.slice(s.indexOf("#") + 1) : null;
  if (hash !== null) {
    const params = new URLSearchParams(hash);
    const listId = params.get("list");
    const token = params.get("t");
    return listId && token ? { listId, token } : null;
  }
  const dot = s.indexOf(".");
  if (dot > 0 && dot < s.length - 1) return { listId: s.slice(0, dot), token: s.slice(dot + 1) };
  return null;
}

export function randomToken(bytes = 32, random: (len: number) => Uint8Array = defaultRandom): string {
  const arr = random(bytes);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}

function defaultRandom(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}
