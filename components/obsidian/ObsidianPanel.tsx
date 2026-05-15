"use client";

import * as React from "react";
import { FileText, Folder, RefreshCw, Save, Plug } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  loadObsidianConfig,
  saveObsidianConfig,
  probe,
  listVault,
  readNote,
  writeNote,
  type ObsidianConfig,
  type VaultFile,
} from "@/lib/obsidian/client";
import { useWorkshop } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ObsidianPanel() {
  const markdown = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);

  const [config, setConfig] = React.useState<ObsidianConfig | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState("http://127.0.0.1:27123");
  const [apiKey, setApiKey] = React.useState("");
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "ok"; version?: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [path, setPath] = React.useState("");
  const [files, setFiles] = React.useState<VaultFile[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const cfg = loadObsidianConfig();
    if (cfg) {
      setConfig(cfg);
      setBaseUrl(cfg.baseUrl);
      setApiKey(cfg.apiKey);
    } else {
      setEditing(true);
    }
  }, []);

  const test = async (cfg: ObsidianConfig) => {
    const r = await probe(cfg);
    if (r.ok) {
      setStatus({ kind: "ok", version: r.version });
    } else {
      setStatus({ kind: "error", message: r.error ?? "未知错误" });
    }
  };

  const saveConfig = async () => {
    const cfg = { baseUrl: baseUrl.trim(), apiKey: apiKey.trim() };
    saveObsidianConfig(cfg);
    setConfig(cfg);
    setEditing(false);
    test(cfg);
  };

  const refresh = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const list = await listVault(config, path);
      setFiles(list);
      setStatus({ kind: "ok" });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (f: VaultFile) => {
    if (!config) return;
    if (f.isFolder) {
      setPath(f.path);
      const list = await listVault(config, f.path);
      setFiles(list);
      return;
    }
    if (!f.path.endsWith(".md")) return;
    setBusy(true);
    try {
      const content = await readNote(config, f.path);
      setMarkdown(content);
      setActivePath(f.path);
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const saveBack = async () => {
    if (!config || !activePath) return;
    setBusy(true);
    try {
      await writeNote(config, activePath, markdown);
      setStatus({ kind: "ok" });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const goUp = async () => {
    if (!config) return;
    const next = path.split("/").slice(0, -1).join("/");
    setPath(next);
    const list = await listVault(config, next);
    setFiles(list);
  };

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug size={14} className="text-app-fg-muted" />
            <span className="font-medium">Obsidian Vault</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "取消" : config ? "重设" : "连接"}
          </Button>
        </div>
        <StatusLine status={status} />
        {editing && (
          <div className="mt-3 space-y-2">
            <Input label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="http://127.0.0.1:27123" />
            <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder="from Local REST API plugin" password />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => test({ baseUrl, apiKey })}>
                测试连接
              </Button>
              <Button size="sm" onClick={saveConfig}>保存</Button>
            </div>
            <p className="text-[11px] text-app-fg-muted leading-relaxed">
              在 Obsidian 中安装 <code className="bg-app-surface-hover px-1 rounded">Local REST API</code> 插件，复制其 API Key 到这里。
              该插件仅在本机运行，仅你浏览器访问。
            </p>
          </div>
        )}
      </div>

      {config && !editing && (
        <>
          <div className="px-4 py-2 border-b border-app-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-app-fg-subtle shrink-0">路径:</span>
              <span className="font-mono text-app-fg-muted truncate">/{path || ""}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              {path && (
                <Button size="iconSm" variant="ghost" onClick={goUp} title="返回上级">
                  ↑
                </Button>
              )}
              <Button size="iconSm" variant="ghost" onClick={refresh} title="刷新" disabled={busy}>
                <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {files.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-app-fg-muted">
                点上方刷新按钮，或先确认插件已启动。
              </div>
            ) : (
              <ul className="py-1">
                {files.map((f) => {
                  const active = f.path === activePath;
                  return (
                    <li key={f.path}>
                      <button
                        onClick={() => openFile(f)}
                        className={cn(
                          "w-full text-left flex items-center gap-2 px-4 py-1.5 hover:bg-app-surface-hover transition-colors",
                          active && "bg-app-surface-hover text-app-fg"
                        )}
                      >
                        {f.isFolder ? (
                          <Folder size={13} className="text-app-fg-muted shrink-0" />
                        ) : (
                          <FileText size={13} className="text-app-fg-muted shrink-0" />
                        )}
                        <span className="text-xs truncate">
                          {f.path.split("/").pop()}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {activePath && (
            <div className="px-4 py-3 border-t border-app-border space-y-2">
              <div className="text-[11px] text-app-fg-muted truncate">
                当前文档: <span className="font-mono text-app-fg">{activePath}</span>
              </div>
              <Button size="sm" className="w-full" onClick={saveBack} disabled={busy}>
                <Save size={13} /> 写回 Vault
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusLine({
  status,
}: {
  status:
    | { kind: "idle" }
    | { kind: "ok"; version?: string }
    | { kind: "error"; message: string };
}) {
  if (status.kind === "idle") return null;
  if (status.kind === "ok") {
    return (
      <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
        ✓ 已连接 {status.version ? `(${status.version})` : ""}
      </div>
    );
  }
  return (
    <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 break-all">
      ✗ {status.message}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  password,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  password?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <input
        value={value}
        type={password ? "password" : "text"}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs text-app-fg font-mono placeholder:text-app-fg-subtle focus:outline-none focus:border-app-fg-muted"
      />
    </label>
  );
}
