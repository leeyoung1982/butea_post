// Obsidian Local REST API client. Runs in the browser. The user must have
// installed the "Local REST API" plugin in Obsidian and configured the API key.
// Default insecure HTTP port is 27123; HTTPS is 27124 (self-signed).

export type ObsidianConfig = {
  baseUrl: string; // e.g. http://127.0.0.1:27123
  apiKey: string;
};

export type VaultFile = {
  path: string;
  isFolder: boolean;
};

const STORAGE_KEY = "claude-wechat-llm:obsidian";

export function loadObsidianConfig(): ObsidianConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ObsidianConfig) : null;
  } catch {
    return null;
  }
}

export function saveObsidianConfig(cfg: ObsidianConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function headers(cfg: ObsidianConfig, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    ...(extra || {}),
  };
}

export async function listVault(cfg: ObsidianConfig, path = ""): Promise<VaultFile[]> {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/vault/${encodeURI(path)}${path && !path.endsWith("/") ? "/" : ""}`;
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) throw new Error(`Obsidian list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files: string[] };
  return data.files.map((f) => ({
    path: path ? `${path.replace(/\/$/, "")}/${f}` : f,
    isFolder: f.endsWith("/"),
  }));
}

export async function readNote(cfg: ObsidianConfig, path: string): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/vault/${encodeURI(path)}`;
  const res = await fetch(url, {
    headers: headers(cfg, { Accept: "text/markdown" }),
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  return res.text();
}

export async function writeNote(
  cfg: ObsidianConfig,
  path: string,
  content: string
): Promise<void> {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/vault/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(cfg, { "Content-Type": "text/markdown" }),
    body: content,
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status} ${await res.text()}`);
}

export async function probe(cfg: ObsidianConfig): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/`;
    const res = await fetch(url, { headers: headers(cfg) });
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    const j = await res.json().catch(() => ({}));
    return { ok: true, version: j.versions?.self || j.service };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
