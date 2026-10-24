import * as Network from 'expo-network';

// Conversa pelo Wi-Fi com o app "Projetor Ponte" instalado no projetor.
export const PORT = 8765;

export type ProjectorApp = { pkg: string; label: string };
export type NowPlaying = { pkg: string; appLabel: string; title: string; subtitle: string; playing: boolean } | null;

async function get(ip: string, path: string, timeoutMs = 2500): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`http://${ip}:${PORT}${path}`, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export const projector = {
  iconUrl: (ip: string, pkg: string) => `http://${ip}:${PORT}/icon?pkg=${encodeURIComponent(pkg)}`,

  async ping(ip: string): Promise<{ name: string } | null> {
    try {
      const r = await get(ip, '/ping', 1200);
      if (!r.ok) return null;
      return (await r.json()) as { name: string };
    } catch {
      return null;
    }
  },

  async apps(ip: string): Promise<ProjectorApp[]> {
    const r = await get(ip, '/apps', 6000);
    return (await r.json()) as ProjectorApp[];
  },

  async launch(ip: string, pkg: string) {
    await get(ip, `/launch?pkg=${encodeURIComponent(pkg)}`);
  },

  async openUrl(ip: string, url: string, pkg?: string) {
    const q = `url=${encodeURIComponent(url)}` + (pkg ? `&pkg=${encodeURIComponent(pkg)}` : '');
    await get(ip, `/open?${q}`);
  },

  async nowPlaying(ip: string): Promise<NowPlaying> {
    try {
      const r = await get(ip, '/nowplaying', 2000);
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.title ? (j as NowPlaying) : null;
    } catch {
      return null;
    }
  },

  /** Procura o projetor na rede (testa todos os endereços da mesma faixa do celular). */
  async discover(onProgress?: (n: number) => void): Promise<string | null> {
    const myIp = await Network.getIpAddressAsync();
    const parts = myIp.split('.');
    if (parts.length !== 4) return null;
    const base = parts.slice(0, 3).join('.');
    let found: string | null = null;
    let done = 0;
    const batch = 32;
    for (let start = 1; start < 255 && !found; start += batch) {
      const tries: Promise<void>[] = [];
      for (let i = start; i < Math.min(start + batch, 255); i++) {
        const ip = `${base}.${i}`;
        tries.push(
          projector.ping(ip).then((r) => {
            done++;
            if (r && !found) found = ip;
          })
        );
      }
      await Promise.all(tries);
      onProgress?.(done);
    }
    return found;
  },
};
